/**
 * Tests de autenticación: validadores, cuentas, sesión local y guard de rutas.
 * Ejecutar con: npm test
 *
 * Importa los módulos REALES (js/auth.js, js/store.js); solo se hace
 * mock de localStorage, que es el único acceso a entorno en tiempo de ejecución.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// --- Mock de localStorage (Node no lo expone de forma fiable) ---
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

const auth = await import('../js/auth.js');
const store = await import('../js/store.js');

const {
  isValidEmail, normalizeEmail, isValidPhone, passwordProblem,
  createAccount, verifyCredentials, hashPassword,
  register, login, logout, restoreSession, updateAccountProfile,
  requiresAuth, loadAuthData, saveAuthData,
} = auth;

const { initStore, getState, customerOrders } = store;

initStore();

// ============================================================
// Validadores
// ============================================================

test('valida y normaliza correos electrónicos', () => {
  assert.equal(isValidEmail('cliente@correo.com'), true);
  assert.equal(isValidEmail('  Cliente@Correo.COM '), true);
  assert.equal(normalizeEmail('  Cliente@Correo.COM '), 'cliente@correo.com');
  assert.equal(isValidEmail('sin-arroba'), false);
  assert.equal(isValidEmail('a@b'), false);
  assert.equal(isValidEmail(''), false);
});

test('valida teléfono panameño (7 u 8 dígitos, inicia en 6 o 7)', () => {
  assert.equal(isValidPhone('6000-0000'), true);
  assert.equal(isValidPhone('61234567'), true);
  assert.equal(isValidPhone('6123-4567'), true);
  assert.equal(isValidPhone('50760000000'), false, 'con código de país no es un número local válido');
  assert.equal(isValidPhone('1234567'), false, 'no inicia en 6/7');
  assert.equal(isValidPhone(''), false);
});

test('la contraseña exige mínimo 8 caracteres, letra y número', () => {
  assert.ok(passwordProblem('abc123'), 'muy corta');
  assert.ok(passwordProblem('abcdefgh'), 'sin número');
  assert.ok(passwordProblem('12345678'), 'sin letra');
  assert.equal(passwordProblem('agua1234'), null, 'válida');
});

// ============================================================
// Lógica pura de cuentas
// ============================================================

test('createAccount valida datos y rechaza correos duplicados', () => {
  const pwHash = 'x'.repeat(64);
  const first = createAccount([], {
    name: 'Ana Pérez', email: 'ana@correo.com', phone: '6000-0000', passwordHash: pwHash,
  });
  assert.equal(first.ok, true);
  assert.equal(first.account.email, 'ana@correo.com');
  assert.equal(first.account.role, 'cliente', 'el rol siempre es cliente (sin escalada)');

  const dup = createAccount([first.account], {
    name: 'Otra Persona', email: 'ANA@correo.com', phone: '6123-4567', passwordHash: pwHash,
  });
  assert.equal(dup.ok, false);
  assert.match(dup.error, /ya existe/i);

  const badEmail = createAccount([], {
    name: 'Ana', email: 'no-es-correo', phone: '6000-0000', passwordHash: pwHash,
  });
  assert.equal(badEmail.ok, false);

  const badPhone = createAccount([], {
    name: 'Ana', email: 'ana@correo.com', phone: '123', passwordHash: pwHash,
  });
  assert.equal(badPhone.ok, false);

  const noName = createAccount([], {
    name: '   ', email: 'ana@correo.com', phone: '6000-0000', passwordHash: pwHash,
  });
  assert.equal(noName.ok, false);
});

test('verifyCredentials solo acepta la contraseña correcta', async () => {
  const hash = await hashPassword('agua1234');
  const accounts = [{
    id: 'a1', name: 'Ana', email: 'ana@correo.com', phone: '6000-0000',
    passwordHash: hash, role: 'cliente',
  }];

  const ok = verifyCredentials(accounts, 'ana@correo.com', hash);
  assert.equal(ok.ok, true);
  assert.equal(ok.account.id, 'a1');

  const wrongPw = verifyCredentials(accounts, 'ana@correo.com', await hashPassword('otra1234'));
  assert.equal(wrongPw.ok, false);

  const wrongEmail = verifyCredentials(accounts, 'otro@correo.com', hash);
  assert.equal(wrongEmail.ok, false);
  assert.match(wrongEmail.error, /incorrectos/i);
});

test('hashPassword es determinista y depende de la contraseña', async () => {
  const a1 = await hashPassword('agua1234');
  const a2 = await hashPassword('agua1234');
  const b = await hashPassword('agua9999');
  assert.equal(a1, a2, 'misma contraseña → mismo hash');
  assert.notEqual(a1, b, 'contraseñas distintas → hashes distintos');
  assert.equal(a1.length, 64, 'SHA-256 en hexadecimal');
  assert.notEqual(a1, 'agua1234', 'nunca se guarda la contraseña en claro');
});

// ============================================================
// Guard de rutas (permisos)
// ============================================================

test('requiresAuth: solo las vistas privadas del cliente exigen sesión', () => {
  assert.equal(requiresAuth('pedidos'), true);
  assert.equal(requiresAuth('cuenta'), true);
  assert.equal(requiresAuth('confirmacion'), true);
  assert.equal(requiresAuth('inicio'), false, 'inicio es público');
  assert.equal(requiresAuth('catalogo'), false, 'catálogo es público');
  assert.equal(requiresAuth('carrito'), false, 'carrito es público');
  assert.equal(requiresAuth('login'), false, 'la propia pantalla de login es pública');
  assert.equal(requiresAuth('admin'), false, 'admin depende del selector de rol (demo)');
  assert.equal(requiresAuth('repartidor'), false, 'repartidor depende del selector de rol (demo)');
});

// ============================================================
// Pedidos: propiedad de los pedidos
// ============================================================

test('customerOrders: cada cliente solo ve SUS pedidos', () => {
  const orders = [
    { id: 'o1', customerId: 'user-1', number: 'AC-0001' },
    { id: 'o2', customerId: 'user-2', number: 'AC-0002' },
    { id: 'o3', number: 'AC-0003' }, // manual / sin dueño
    { id: 'o4', customerId: 'user-1', number: 'AC-0004' },
  ];

  const mine = customerOrders(orders, 'user-1');
  assert.deepEqual(mine.map(o => o.id), ['o1', 'o4'], 'solo los suyos');

  const other = customerOrders(orders, 'user-2');
  assert.deepEqual(other.map(o => o.id), ['o2'], 'no ve los de user-1');

  assert.deepEqual(customerOrders(orders, ''), [], 'sin sesión no ve ninguno');
  assert.deepEqual(customerOrders(orders, undefined), [], 'userId ausente no ve ninguno');
});

// ============================================================
// Flujo completo local: registro → sesión → persistencia → login
// ============================================================

test('registro, sesión, persistencia y cierre de sesión (modo local)', async () => {
  // Registro crea sesión y refleja el usuario en el store
  const reg = await register({
    name: 'María López', phone: '6123-4567', email: 'maria@correo.com', password: 'agua1234',
  });
  assert.equal(reg.ok, true, JSON.stringify(reg));
  let s = getState();
  assert.equal(s.isLoggedIn, true);
  assert.equal(s.role, 'cliente');
  assert.equal(s.user.email, 'maria@correo.com');
  assert.ok(s.user.id, 'el usuario tiene id de cuenta');

  // Registro duplicado falla
  const dup = await register({
    name: 'Otra', phone: '6000-0000', email: 'MARIA@correo.com', password: 'agua1234',
  });
  assert.equal(dup.ok, false);

  // Registro con contraseña débil falla
  const weak = await register({
    name: 'Otra', phone: '6000-0000', email: 'otra@correo.com', password: 'corta',
  });
  assert.equal(weak.ok, false);
  assert.match(weak.error, /8 caracteres/i);

  // Persistencia: la cuenta y la sesión están en localStorage
  const data = loadAuthData();
  assert.equal(data.accounts.length, 1, 'una cuenta persistida');
  assert.equal(data.session.userId, data.accounts[0].id);

  // Simular recarga de la app: estado limpio + restoreSession
  storage.delete('agua-clara-v3');
  initStore();
  assert.equal(getState().isLoggedIn, false, 'estado fresh sin sesión');
  restoreSession();
  assert.equal(getState().isLoggedIn, true, 'la sesión se restaura desde localStorage');
  assert.equal(getState().user.email, 'maria@correo.com');

  // Login con contraseña incorrecta falla
  const badLogin = await login('maria@correo.com', 'contrasena-mala1');
  assert.equal(badLogin.ok, false);

  // Cerrar sesión limpia store y sesión persistida
  logout();
  s = getState();
  assert.equal(s.isLoggedIn, false);
  assert.equal(s.user.id, '');
  assert.equal(s.user.email, '');
  assert.equal(loadAuthData().session, null, 'sin sesión persistida');

  // Login correcto restablece la sesión
  const okLogin = await login('maria@correo.com', 'agua1234');
  assert.equal(okLogin.ok, true, JSON.stringify(okLogin));
  assert.equal(getState().isLoggedIn, true);
});

test('updateAccountProfile actualiza nombre/teléfono de la cuenta activa', async () => {
  const data = loadAuthData();
  assert.ok(data.session?.userId, 'hay una sesión activa del test anterior');
  updateAccountProfile({ name: 'María L. Actualizada', phone: '6999-9999' });
  const updated = loadAuthData().accounts.find(a => a.id === data.session.userId);
  assert.equal(updated.name, 'María L. Actualizada');
  assert.equal(updated.phone, '6999-9999');
  assert.equal(updated.email, 'maria@correo.com', 'el correo de login no cambia');
});

test('saveAuthData rechaza estructuras corruptas de forma segura', () => {
  storage.set('agua-clara-auth-v1', '{corrupto');
  const data = loadAuthData();
  assert.deepEqual(data, { accounts: [], session: null }, 'estructura por defecto');
  // Restaurar estructura válida para pruebas posteriores
  saveAuthData({ accounts: [], session: null });
});
