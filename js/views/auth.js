/**
 * views/auth.js — Pantallas de login y registro de cliente.
 * Usa las clases .auth-screen / .auth-card / .auth-logo ya definidas en styles.css.
 */

import { getState, setState, esc } from '../store.js';
import { login, register, demoLogin, isSupabaseAuthEnabled } from '../auth.js';
import { navigate, showToast, renderApp } from '../router.js';
import { appFooter } from '../ui.js';
import { icon } from '../icons.js';

/** Renderiza la pantalla de autenticación según el modo (login | registro) */
export function authView() {
  const s = getState();
  const mode = s.view === 'registro' ? 'registro' : 'login';
  const isRegister = mode === 'registro';

  const modeNote = isSupabaseAuthEnabled()
    ? ''
    : '<p class="text-xs text-muted text-center mt-1">Cuenta local: tus datos se guardan solo en este dispositivo (modo demo sin servidor).</p>';

  const fields = isRegister ? `
    <div class="field">
      <label for="auth-name">Nombre completo</label>
      <input id="auth-name" autocomplete="name" placeholder="Tu nombre" required>
    </div>
    <div class="field">
      <label for="auth-phone">Teléfono</label>
      <input id="auth-phone" type="tel" autocomplete="tel" placeholder="6000-0000" required>
    </div>` : '';

  return `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-logo">${icon('droplet', 40)}</div>
        <h1>${isRegister ? 'Crear cuenta' : 'Iniciar sesión'}</h1>
        <p>${isRegister
          ? 'Regístrate para hacer pedidos y ver tu historial.'
          : 'Ingresa para ver tus pedidos y guardar tus direcciones.'}</p>

        <form id="auth-form" class="stack" novalidate>
          ${fields}
          <div class="field">
            <label for="auth-email">Correo electrónico</label>
            <input id="auth-email" type="email" autocomplete="email" placeholder="correo@ejemplo.com" required>
          </div>
          <div class="field">
            <label for="auth-password">Contraseña</label>
            <input id="auth-password" type="password"
              autocomplete="${isRegister ? 'new-password' : 'current-password'}"
              placeholder="${isRegister ? 'Mín. 8 caracteres, letra y número' : 'Tu contraseña'}" required>
          </div>
          <button class="btn-primary btn-lg btn-full" id="btn-auth-submit" type="submit">
            ${isRegister ? icon('check') + ' Crear cuenta' : 'Ingresar ' + icon('arrowRight')}
          </button>
        </form>

        ${modeNote}

        ${!isRegister ? `
          <div class="demo-access" aria-label="Accesos rápidos de demostración">
            <span class="demo-access-title">Probar la web sin cuenta</span>
            <div class="demo-access-grid">
              <button type="button" class="btn-outline btn-sm" data-demo-role="cliente">Entrar como cliente</button>
              <button type="button" class="btn-outline btn-sm" data-demo-role="repartidor">Entrar como repartidor</button>
              <button type="button" class="btn-outline btn-sm" data-demo-role="admin">Entrar como administradora</button>
            </div>
          </div>` : ''}

        <div class="auth-toggle">
          ${isRegister
            ? '¿Ya tienes cuenta? <a data-auth-mode="login" role="button" tabindex="0">Inicia sesión</a>'
            : '¿No tienes cuenta? <a data-auth-mode="registro" role="button" tabindex="0">Regístrate</a>'}
        </div>
        <div class="auth-toggle">
          <a data-nav="inicio" role="button" tabindex="0">${icon('arrowLeft', 15)} Volver al inicio</a>
        </div>
      </div>
    </div>
    ${appFooter()}`;
}

/** Vincula los eventos de las pantallas de autenticación */
export function bindAuthEvents() {
  const s = getState();
  const mode = s.view === 'registro' ? 'registro' : 'login';

  document.querySelectorAll('[data-demo-role]').forEach(btn => {
    btn.onclick = () => {
      demoLogin(btn.dataset.demoRole);
      const target = getState().view;
      history.replaceState(null, '', `#${target}`);
      showToast(`Entraste como ${btn.textContent.replace('Entrar como ', '')}`, 'success');
      renderApp();
    };
  });

  // Cambiar entre login y registro
  document.querySelectorAll('[data-auth-mode]').forEach(el => {
    el.onclick = (e) => {
      e.preventDefault();
      setState({ view: el.dataset.authMode });
      renderApp();
    };
    el.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setState({ view: el.dataset.authMode });
        renderApp();
      }
    };
  });

  // Envío del formulario
  const form = document.getElementById('auth-form');
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-auth-submit');
    const email = document.getElementById('auth-email')?.value.trim() || '';
    const password = document.getElementById('auth-password')?.value || '';

    if (btn) { btn.disabled = true; btn.textContent = 'Un momento...'; }

    const result = mode === 'registro'
      ? await register({
          name: document.getElementById('auth-name')?.value.trim() || '',
          phone: document.getElementById('auth-phone')?.value.trim() || '',
          email,
          password,
        })
      : await login(email, password);

    if (!result.ok) {
      showToast(result.error || 'No se pudo completar la operación', 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = mode === 'registro' ? icon('check') + ' Crear cuenta' : 'Ingresar ' + icon('arrowRight');
      }
      return;
    }

    const fresh = getState();
    const target = fresh.authReturnTo || 'inicio';
    setState({ authReturnTo: '' });
    showToast(mode === 'registro' ? 'Cuenta creada. ¡Bienvenido!' : 'Sesión iniciada', 'success');
    navigate(target);
  };
}
