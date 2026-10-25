/**
 * router.js — Enrutador simple para la SPA.
 * Controla qué vista se muestra según el rol y la vista activa.
 */

import { getState, setState } from './store.js';
import { toastContainer, renderToast } from './ui.js';
import { requiresAuth, logout } from './auth.js';

let renderFn = null;
let afterRenderFn = null;
const root = document.getElementById('app');

/** Registra la función principal de render y el callback post-render */
export function initRouter(render, afterRender) {
  renderFn = render;
  afterRenderFn = afterRender;
  window.addEventListener('popstate', () => {
    const hash = location.hash.slice(1) || 'inicio';
    const s = getState();
    if (s.view !== hash) {
      // Ruta protegida sin sesión: mostrar login y recordar el destino
      if (requiresAuth(hash) && !s.isLoggedIn) {
        setState({ view: 'login', authReturnTo: hash });
      } else {
        setState({ view: hash });
      }
      renderApp();
    }
  });
}

/** Navega a una vista */
export function navigate(view) {
  const s = getState();
  if (requiresAuth(view) && !s.isLoggedIn) {
    // Ruta protegida sin sesión: login con retorno al destino original
    setState({ view: 'login', authReturnTo: view });
    history.pushState(null, '', '#login');
    renderApp();
    return;
  }
  setState({ view });
  history.pushState(null, '', `#${view}`);
  renderApp();
}

/** Renderiza la app completa */
export function renderApp() {
  if (!renderFn) return;
  const html = renderFn();
  root.innerHTML = toastContainer() + html;
  bindGlobalEvents();
  // Ejecutar callback post-render (para vincular eventos de cada módulo)
  if (afterRenderFn) {
    try { afterRenderFn(); } catch (e) { console.error('Post-render error:', e); }
  }
}

/** Vincula eventos globales que existen en toda la app */
function bindGlobalEvents() {
  // Cerrar sesión (visible solo cuando hay sesión)
  const logoutBtn = root.querySelector('#btn-logout');
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      logout();
      showToast('Sesión cerrada', 'info');
      renderApp();
    };
  }

  // Role switch (demo)
  const roleSelect = root.querySelector('#demo-role');
  if (roleSelect) {
    roleSelect.onchange = (e) => {
      const role = e.target.value;
      const viewMap = { cliente: 'inicio', admin: 'admin', repartidor: 'repartidor' };
      setState({ role, view: viewMap[role] || 'inicio' });
      renderApp();
    };
  }

  // Navigation buttons
  root.querySelectorAll('[data-nav]').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      navigate(btn.dataset.nav);
    };
  });
}

/** Muestra un toast (importado por otros módulos) */
export function showToast(message, type = 'info') {
  // Importamos dinámicamente para evitar circular
  import('./ui.js').then(({ renderToast }) => renderToast(message, type));
}
