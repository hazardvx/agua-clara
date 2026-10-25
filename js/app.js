/**
 * app.js — Punto de entrada principal de Agua Clara PWA.
 *
 * Conecta el store, el router y los módulos de vistas (cliente, admin, repartidor).
 * Gestiona el render global y el binding de eventos según el rol activo.
 */

import { initStore, getState, setState } from './store.js';
import { initRouter, renderApp } from './router.js';
import { requiresAuth, restoreSession } from './auth.js';
import { authView, bindAuthEvents } from './views/auth.js';
import {
  clientHome, clientCatalog, clientCart, clientConfirmation,
  clientOrders, clientAccount, bindClientEvents
} from './views/cliente.js';
import {
  adminOrders, adminReparto, adminProducts, adminVentas,
  adminConfig, adminManual, bindAdminEvents
} from './views/admin.js';
import {
  courierDeliveries, courierHistory, bindCourierEvents
} from './views/repartidor.js';

// --- Inicialización ---
const initialState = initStore();
// La demo siempre empieza en login cuando no existe una sesión activa.
if (!initialState.isLoggedIn) setState({ view: 'login' });
// Restaurar sesión persistida (síncrono en modo local; async en Supabase)
const sessionRestore = restoreSession();
if (sessionRestore && typeof sessionRestore.then === 'function') {
  sessionRestore.then(() => renderApp()).catch(() => { /* sin red */ });
}
// Si la app arranca en una vista privada sin sesión, recordarla como
// destino para volver allí tras el login (hash profundo o última vista).
if (requiresAuth(getState().view) && !getState().isLoggedIn) {
  setState({ authReturnTo: getState().view });
}

/** Función principal de render: devuelve el HTML según el rol y la vista */
function render() {
  const s = getState();

  // --- Autenticación de cliente ---
  if (s.role === 'cliente' && (s.view === 'login' || s.view === 'registro')) return authView();
  if (s.role === 'cliente' && requiresAuth(s.view) && !s.isLoggedIn) {
    return authView();
  }

  // --- Cliente ---
  if (s.role === 'cliente') {
    switch (s.view) {
      case 'catalogo': return clientCatalog();
      case 'carrito': return clientCart();
      case 'confirmacion': return clientConfirmation();
      case 'pedidos': return clientOrders();
      case 'cuenta': return clientAccount();
      default: return clientHome();
    }
  }

  // --- Administradora ---
  if (s.role === 'admin') {
    switch (s.view) {
      case 'reparto': return adminReparto();
      case 'productos': return adminProducts();
      case 'ventas': return adminVentas();
      case 'configuracion': return adminConfig();
      case 'manual': return adminManual();
      default: return adminOrders();
    }
  }

  // --- Repartidor ---
  if (s.role === 'repartidor') {
    switch (s.view) {
      case 'historial': return courierHistory();
      default: return courierDeliveries();
    }
  }

  return clientHome();
}

/** Callback post-render: vincula eventos específicos del módulo activo */
function afterRender() {
  const s = getState();

  // Pantalla de autenticación activa
  const authScreen = s.role === 'cliente' && (
    (s.view === 'login' || s.view === 'registro')
      ? !s.isLoggedIn
      : (requiresAuth(s.view) && !s.isLoggedIn)
  );
  if (authScreen) { bindAuthEvents(); return; }

  if (s.role === 'cliente') bindClientEvents();
  else if (s.role === 'admin') bindAdminEvents();
  else if (s.role === 'repartidor') bindCourierEvents();
}

// Registrar render y post-render en el router
initRouter(render, afterRender);

// Eventos de conectividad
window.addEventListener('online', () => renderApp());
window.addEventListener('offline', () => renderApp());

// Registrar service worker
if ('serviceWorker' in navigator && !location.hostname.endsWith('github.io')) {
  navigator.serviceWorker.register(new URL('sw.js', document.baseURI)).catch(err => {
    console.warn('Service Worker no registrado:', err);
  });
}

// Render inicial
renderApp();
