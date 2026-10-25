/**
 * auth.js — Capa de autenticación de Agua Clara.
 *
 * Conmutable según configuración:
 *  - Con credenciales Supabase (SUPABASE_URL + SUPABASE_ANON_KEY): usa
 *    Supabase Auth vía REST (signup, password grant, logout, user) y
 *    persiste el perfil en public.profiles (RLS de 001/002).
 *  - Sin credenciales (estado actual): cuentas locales en localStorage,
 *    solo en este dispositivo. Es un modo de desarrollo, NO producción:
 *    las contraseñas se guardan como hash SHA-256, pero sin servidor.
 *
 * Este módulo no toca el DOM ni localStorage en tiempo de importación,
 * por lo que es testeable con node --test.
 */

import { setState, getState, uid } from './store.js';

const AUTH_KEY = 'agua-clara-auth-v1';

// Credenciales Supabase (rellenar para activar auth real en el navegador).
// Nunca usar service_role en el frontend.
const SUPABASE_URL = '';
const SUPABASE_ANON_KEY = '';

/** true cuando hay credenciales Supabase configuradas */
export function isSupabaseAuthEnabled() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

// ============================================================
// Validadores puros
// ============================================================

/** Normaliza un correo a minúsculas y sin espacios */
export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/** Valida formato de correo electrónico */
export function isValidEmail(email) {
  const e = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/** Valida teléfono panameño: 7 u 8 dígitos (con o sin guiones/espacios) */
export function isValidPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return /^[67]\d{6,7}$/.test(digits);
}

/** Devuelve el problema de la contraseña, o null si es válida (mín. 8, letra y número) */
export function passwordProblem(password) {
  const pw = String(password || '');
  if (pw.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (!/[a-zA-Z]/.test(pw)) return 'La contraseña debe incluir al menos una letra';
  if (!/[0-9]/.test(pw)) return 'La contraseña debe incluir al menos un número';
  return null;
}

// ============================================================
// Lógica pura de cuentas (hashes ya calculados; sin E/S)
// ============================================================

/** Busca una cuenta por correo (case-insensitive) */
export function findAccount(accounts, email) {
  const e = normalizeEmail(email);
  return accounts.find(a => a.email === e) || null;
}

/**
 * Crea una cuenta local valida.
 * @returns {{ok:boolean, error?:string, account?:object}}
 */
export function createAccount(accounts, { name, email, phone, passwordHash }) {
  const cleanName = String(name || '').trim();
  const cleanEmail = normalizeEmail(email);
  const cleanPhone = String(phone || '').trim();

  if (!cleanName) return { ok: false, error: 'Escribe tu nombre completo' };
  if (!isValidEmail(cleanEmail)) return { ok: false, error: 'Correo electrónico inválido' };
  if (!isValidPhone(cleanPhone)) return { ok: false, error: 'Teléfono panameño inválido (ej: 6000-0000)' };
  if (findAccount(accounts, cleanEmail)) {
    return { ok: false, error: 'Ya existe una cuenta con ese correo' };
  }

  return {
    ok: true,
    account: {
      id: uid(),
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      passwordHash,
      role: 'cliente',
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Verifica credenciales contra la lista de cuentas.
 * @returns {{ok:boolean, error?:string, account?:object}}
 */
export function verifyCredentials(accounts, email, passwordHash) {
  const account = findAccount(accounts, email);
  if (!account) return { ok: false, error: 'Correo o contraseña incorrectos' };
  if (account.passwordHash !== passwordHash) {
    return { ok: false, error: 'Correo o contraseña incorrectos' };
  }
  return { ok: true, account };
}

// ============================================================
// Hash de contraseña (SHA-256)
// ============================================================

/** Devuelve el hash SHA-256 en hexadecimal de una contraseña */
export async function hashPassword(password) {
  const data = new TextEncoder().encode(String(password));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================================
// Persistencia local (localStorage)
// ============================================================

function readAuthData() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (data && Array.isArray(data.accounts)) return data;
  } catch { /* corrupto o no disponible */ }
  return { accounts: [], session: null };
}

function writeAuthData(data) {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(data));
  } catch { /* storage lleno o no disponible */ }
}

/** Expone la estructura almacenada (para pruebas y depuración) */
export function loadAuthData() {
  return readAuthData();
}

/** Guarda la estructura almacenada (para pruebas) */
export function saveAuthData(data) {
  writeAuthData(data);
}

// ============================================================
// Sesión → store
// ============================================================

/** Aplica la cuenta activa al store central */
function applySession(account, extra = {}) {
  setState({
    isLoggedIn: true,
    role: 'cliente',
    user: { id: account.id, name: account.name, phone: account.phone, email: account.email },
    ...extra,
  });
}

/** Devuelve la cuenta activa, o null */
export function currentAccount() {
  const { accounts, session } = readAuthData();
  if (!session || !session.userId) return null;
  return accounts.find(a => a.id === session.userId) || null;
}

// ============================================================
// API pública (async): registro, login, logout, restauración
// ============================================================

function supabaseHeaders(token) {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
  };
}

async function supabaseCall(path, body, token) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: supabaseHeaders(token),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error_description || data.msg || data.message || 'Error de autenticación';
    throw new Error(msg);
  }
  return data;
}

/**
 * Registra una nueva cuenta de cliente.
 * @returns {Promise<{ok:boolean, error?:string}>}
 */
export async function register({ name, phone, email, password }) {
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem };

  if (isSupabaseAuthEnabled()) {
    try {
      const data = await supabaseCall('signup', {
        email: normalizeEmail(email),
        password: String(password),
        data: { full_name: String(name || '').trim(), phone: String(phone || '').trim() },
      });
      // Crear perfil (RLS: "user create own profile" permite id = auth.uid())
      if (data.access_token && data.user) {
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
            method: 'POST',
            headers: supabaseHeaders(data.access_token),
            body: JSON.stringify({
              id: data.user.id,
              full_name: String(name || '').trim(),
              phone: String(phone || '').trim(),
              role: 'cliente',
            }),
          });
        } catch { /* el perfil puede requerir confirmación de correo */ }
        applySession({
          id: data.user.id,
          name: String(name || '').trim(),
          phone: String(phone || '').trim(),
          email: normalizeEmail(email),
        });
        writeAuthData({
          accounts: readAuthData().accounts,
          session: { userId: data.user.id, accessToken: data.access_token, mode: 'supabase' },
        });
        return { ok: true };
      }
      return { ok: true, error: 'Confirma tu correo para activar la cuenta' };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // Modo local (demo)
  const passwordHash = await hashPassword(password);
  const data = readAuthData();
  const result = createAccount(data.accounts, { name, email, phone, passwordHash });
  if (!result.ok) return result;
  data.accounts.push(result.account);
  data.session = { userId: result.account.id, mode: 'local' };
  writeAuthData(data);
  applySession(result.account);
  return { ok: true };
}

/**
 * Inicia sesión con correo y contraseña.
 * @returns {Promise<{ok:boolean, error?:string}>}
 */
export async function login(email, password) {
  if (isSupabaseAuthEnabled()) {
    try {
      const data = await supabaseCall('token?grant_type=password', {
        email: normalizeEmail(email),
        password: String(password),
      });
      const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${data.user.id}`, {
        headers: supabaseHeaders(data.access_token),
      });
      const profiles = await profileRes.json().catch(() => []);
      const profile = Array.isArray(profiles) && profiles[0] ? profiles[0] : {};
      applySession({
        id: data.user.id,
        name: profile.full_name || data.user.user_metadata?.full_name || '',
        phone: profile.phone || data.user.user_metadata?.phone || '',
        email: normalizeEmail(email),
      });
      writeAuthData({
        accounts: readAuthData().accounts,
        session: { userId: data.user.id, accessToken: data.access_token, mode: 'supabase' },
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || 'Correo o contraseña incorrectos' };
    }
  }

  // Modo local (demo)
  const passwordHash = await hashPassword(password);
  const data = readAuthData();
  const result = verifyCredentials(data.accounts, email, passwordHash);
  if (!result.ok) return result;
  data.session = { userId: result.account.id, mode: 'local' };
  writeAuthData(data);
  applySession(result.account);
  return { ok: true };
}

/** Cierra la sesión y limpia el usuario del store */
export function logout() {
  // Si se cierra sesión estando en una vista privada, recordarla para
  // volver allí tras el próximo login.
  const prevView = getState().view;
  const data = readAuthData();
  const token = data.session?.accessToken;
  data.session = null;
  writeAuthData(data);
  if (isSupabaseAuthEnabled() && token) {
    fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: supabaseHeaders(token),
    }).catch(() => { /* sin red */ });
  }
  setState({
    isLoggedIn: false,
    role: 'cliente',
    user: { id: '', name: '', phone: '', email: '' },
    isDemoUser: false,
    authReturnTo: requiresAuth(prevView) ? prevView : '',
  });
}

/** Acceso rápido para probar la demo sin crear credenciales. */
export function demoLogin(role) {
  const profiles = {
    cliente: { id: 'demo-cliente', name: 'Cliente de demostración', phone: '60000000', email: 'cliente.demo@agua.local' },
    admin: { id: 'demo-admin', name: 'Administradora de demostración', phone: '60000001', email: 'admin.demo@agua.local' },
    repartidor: { id: 'demo-repartidor', name: 'Repartidor de demostración', phone: '60000002', email: 'repartidor.demo@agua.local' },
  };
  const user = profiles[role] || profiles.cliente;
  const view = { cliente: 'inicio', admin: 'admin', repartidor: 'repartidor' }[role] || 'inicio';
  setState({ isLoggedIn: true, role, user, view, authReturnTo: '', isDemoUser: true });
  return { ok: true };
}

/**
 * Restaura la sesión persistida al arrancar la app.
 * En modo local es síncrono; en modo Supabase devuelve una promesa.
 */
export function restoreSession() {
  const data = readAuthData();
  if (!data.session || !data.session.userId) return null;

  if (data.session.mode === 'supabase' && data.session.accessToken) {
    return fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: supabaseHeaders(data.session.accessToken),
    })
      .then(res => (res.ok ? res.json() : null))
      .then(user => {
        if (!user) return;
        applySession({
          id: user.id,
          name: user.user_metadata?.full_name || '',
          phone: user.user_metadata?.phone || '',
          email: user.email || '',
        });
      })
      .catch(() => { /* sin red: se queda sin sesión */ });
  }

  const account = data.accounts.find(a => a.id === data.session.userId);
  if (account) applySession(account);
  return null;
}

/**
 * Actualiza nombre/teléfono de la cuenta activa (modo local).
 * El correo es el identificador de login y no se modifica aquí.
 */
export function updateAccountProfile({ name, phone }) {
  const data = readAuthData();
  if (!data.session || !data.session.userId) return;
  const account = data.accounts.find(a => a.id === data.session.userId);
  if (!account) return;
  if (name !== undefined) account.name = String(name).trim();
  if (phone !== undefined) account.phone = String(phone).trim();
  writeAuthData(data);
}

// ============================================================
// Guard de rutas (puro)
// ============================================================

const CLIENT_PRIVATE_VIEWS = ['pedidos', 'cuenta', 'confirmacion'];

/**
 * Indica si una vista requiere sesión de cliente.
 * Las vistas públicas (inicio, catálogo, carrito) no requieren sesión;
 * los paneles de admin/repartidor dependen del selector de rol (demo).
 */
export function requiresAuth(view) {
  return CLIENT_PRIVATE_VIEWS.includes(view);
}
