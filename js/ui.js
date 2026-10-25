/**
 * ui.js — Componentes UI reutilizables para Agua Clara.
 */

import { getState, esc, money, statusBadgeClass, orderCardClass, formatDate, orderActions } from './store.js';
import { icon } from './icons.js';

// --- Toast system ---
let toasts = [];
let toastIdCounter = 0;

export function toastContainer() {
  return '<div class="toast-container" id="toast-container"></div>';
}

export function renderToast(message, type = 'info') {
  const id = ++toastIdCounter;
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.id = `toast-${id}`;
  const icons = { success: 'check', error: 'x', info: 'info' };
  el.innerHTML = `<span class="toast-ico">${icon(icons[type] || 'info', 18)}</span><span>${esc(message)}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-10px)';
    el.style.transition = '0.3s ease-out';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

// --- Shared components ---

/** Topbar con marca y switcher de rol (demo) */
export function topbar() {
  const s = getState();
  const roleLabel = s.role === 'admin' ? 'Administradora' : s.role === 'repartidor' ? 'Repartidor' : 'Cliente';
  return `
    <header class="topbar">
      <div class="brand">
        <div class="brand-icon">${icon('droplet', 24)}</div>
        <div class="brand-text">
          <strong>${esc(s.settings.businessName)}</strong>
          <small>Agua purificada</small>
        </div>
      </div>
      <div class="role-switch">
        <span class="badge badge-blue">${roleLabel}</span>
        ${s.isLoggedIn
          ? `<button id="btn-logout" class="btn-outline btn-sm" type="button">Salir</button>`
          : `<button class="btn-outline btn-sm" type="button" data-nav="login">Ingresar</button>`}
        <select id="demo-role" aria-label="Modo demo: cambiar rol">
          <option value="cliente" ${s.role === 'cliente' ? 'selected' : ''}>Cliente</option>
          <option value="admin" ${s.role === 'admin' ? 'selected' : ''}>Administradora</option>
          <option value="repartidor" ${s.role === 'repartidor' ? 'selected' : ''}>Repartidor</option>
        </select>
      </div>
    </header>`;
}

/** Navegación inferior para cliente */
export function clientNav() {
  const s = getState();
  const items = [
    ['inicio', 'home', 'Inicio'],
    ['catalogo', 'droplet', 'Pedir agua'],
    ['pedidos', 'clipboard', 'Mis pedidos'],
    ['cuenta', 'user', 'Mi cuenta'],
  ];
  return bottomNav(items, s.view);
}

/** Navegación inferior para administradora */
export function adminNav() {
  const s = getState();
  const items = [
    ['admin', 'clipboard', 'Pedidos'],
    ['reparto', 'truck', 'Reparto'],
    ['productos', 'box', 'Productos'],
    ['ventas', 'chart', 'Ventas'],
    ['configuracion', 'settings', 'Configuración'],
  ];
  return bottomNav(items, s.view);
}

/** Navegación inferior para repartidor */
export function courierNav() {
  const s = getState();
  const items = [
    ['repartidor', 'pin', 'Mis entregas'],
    ['historial', 'history', 'Mi historial'],
  ];
  return bottomNav(items, s.view);
}

/** Componente de navegación inferior genérico */
function bottomNav(items, activeView) {
  return `
    <nav class="bottom-nav" role="navigation" aria-label="Navegación principal">
      ${items.map(([id, iconName, label]) => `
        <button class="${activeView === id ? 'active' : ''}" data-nav="${id}" aria-current="${activeView === id ? 'page' : 'false'}">
          <span class="nav-icon">${icon(iconName, 22)}</span>
          <span>${label}</span>
        </button>
      `).join('')}
    </nav>`;
}

/** Sección hero del cliente */
export function hero() {
  const s = getState();
  const count = s.cart.reduce((a, i) => a + i.qty, 0);
  return `
    <section class="hero">
      <h1>Agua fresca,<br>sin complicaciones</h1>
      <p>Haz tu pedido en pocos pasos y recibe tus garrafones en casa.</p>
      <div class="hero-actions">
        <button class="btn-white btn-lg" data-nav="catalogo">${icon('droplet')} Pedir agua</button>
        ${count > 0 ? `<button class="btn-outline btn-lg" style="color:#fff;border-color:rgba(255,255,255,0.4)" data-nav="carrito">${icon('cart')} Carrito (${count})</button>` : ''}
      </div>
    </section>`;
}

/** Tarjeta de producto */
export function productCard(product) {
  return `
    <article class="card product-card" data-animation="slide">
      <div class="product-img">
        ${product.image
          ? `<img src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy" width="800" height="800">`
          : icon('droplet', 56)}
        <span class="product-badge badge ${product.type === 'Retornable' ? 'badge-cyan' : 'badge-blue'}">5 galones</span>
      </div>
      <h3>${esc(product.name)}</h3>
      <p class="text-sm text-muted">${esc(product.description || '')}</p>
      <div class="row row-between">
        <span class="product-price">${money(product.priceCents)} <small>/unidad</small></span>
        <button class="btn-primary btn-sm" data-add="${product.id}">${icon('plus', 16)} Agregar</button>
      </div>
    </article>`;
}

/** Tarjeta de pedido para el cliente */
export function clientOrderCard(order) {
  const maps = order.mode === 'delivery' ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address || '')}` : '';
  return `
    <article class="card order-card ${orderCardClass(order.status)}">
      <div class="order-header">
        <span class="order-number">Pedido ${esc(order.number)}</span>
        <span class="badge ${statusBadgeClass(order.status)}">${esc(order.status)}</span>
      </div>
      <div class="order-meta">
        <span>${order.items.map(i => `${i.qty} × ${esc(i.name)}`).join(', ')}</span>
        <span class="meta-line">${order.mode === 'delivery' ? icon('home', 15) + esc(order.address) : icon('store', 15) + 'Recogida en el local'}</span>
        ${order.addressReference ? `<span class="text-sm text-muted">Ref: ${esc(order.addressReference)}</span>` : ''}
        <div class="row row-between mt-1">
          <span class="text-sm text-muted">${formatDate(order.createdAt)}</span>
          <span class="order-total">${money(order.totalCents)}</span>
        </div>
        <span class="text-sm text-muted">Pago: ${esc(order.payment)} · ${order.paid ? icon('check', 14) + 'Pagado' : icon('clock', 14) + 'Pendiente'}</span>
      </div>
      <div class="order-actions">
        <button class="btn-secondary btn-sm" data-repeat="${order.id}">${icon('refresh', 16)} Repetir pedido</button>
        ${maps ? `<a class="btn-outline btn-sm" href="${maps}" target="_blank" rel="noreferrer">${icon('pin', 16)} Ver en Maps</a>` : ''}
      </div>
    </article>`;
}

/** Tarjeta de pedido para la administradora */
export function adminOrderCard(order) {
  const s = getState();
  const wa = `https://wa.me/${s.settings.whatsapp}?text=${encodeURIComponent(`Pedido ${order.number}: ${order.items.map(i => `${i.qty}x ${i.name}`).join(', ')}. Total: ${money(order.totalCents)}`)}`;
  const clientWa = order.customerPhone ? `https://wa.me/507${order.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, sobre su pedido ${order.number} en ${s.settings.businessName}.`)}` : '';
  const maps = order.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}` : '';
  const actions = orderActions(order);
  const renderAction = (a) => a.action === 'assign'
    ? `<button class="${a.variant} btn-sm" data-assign="${order.id}">${a.label}</button>`
    : `<button class="${a.variant} btn-sm" data-status="${order.id}:${a.status}">${a.label}</button>`;

  return `
    <article class="card order-card ${orderCardClass(order.status)}">
      <div class="order-header">
        <div>
          <span class="order-number">Pedido ${esc(order.number)}</span>
          ${order.source ? `<span class="badge badge-cyan text-xs ml-1">${esc(order.source)}</span>` : ''}
        </div>
        <span class="badge ${statusBadgeClass(order.status)}">${esc(order.status)}</span>
      </div>
      <div class="order-meta">
        <span><strong>${esc(order.customerName || 'Cliente')}</strong> · ${esc(order.customerPhone || '')}</span>
        <span>${order.items.map(i => `<strong>${i.qty}</strong> × ${esc(i.name)}`).join(', ')}</span>
        <span class="meta-line">${order.mode === 'delivery' ? icon('home', 15) + esc(order.address) : icon('store', 15) + 'Recogida en el local'}</span>
        <div class="row row-between">
          <span class="text-sm">
            Agua: ${money(order.subtotalCents)} · Envío: ${money(order.shippingCents)}
          </span>
          <span class="order-total">${money(order.totalCents)}</span>
        </div>
        <span class="text-sm">Pago: ${esc(order.payment)} · ${order.paid ? '<span class="badge badge-green">Pagado</span>' : '<span class="badge badge-amber">Pendiente de pago</span>'}</span>
        <span class="text-xs text-muted">${formatDate(order.createdAt)}</span>
      </div>
      <div class="order-actions">
        ${actions.filter(a => a.status !== 'Cancelado').map(renderAction).join('')}
        ${maps ? `<a class="btn-outline btn-sm" href="${maps}" target="_blank" rel="noreferrer">${icon('pin', 16)} Maps</a>` : ''}
        ${clientWa ? `<a class="btn-outline btn-sm" href="${clientWa}" target="_blank" rel="noreferrer">${icon('message', 16)} WhatsApp</a>` : ''}
        ${!order.paid ? `<button class="btn-outline btn-sm" data-paid="${order.id}">${icon('wallet', 16)} Registrar pago</button>` : ''}
        ${actions.filter(a => a.status === 'Cancelado').map(renderAction).join('')}
      </div>
    </article>`;
}

/** Tarjeta de entrega para el repartidor */
export function courierDeliveryCard(order) {
  const s = getState();
  const maps = order.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}` : '';
  const clientWa = order.customerPhone ? `https://wa.me/507${order.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, voy en camino con su pedido ${order.number}.`)}` : '';

  const needsCollect = order.payment === 'Efectivo al recibir' && !order.paid;

  return `
    <article class="card delivery-card order-card ${orderCardClass(order.status)}">
      <div class="delivery-priority"></div>
      <div style="padding: 1rem;">
        <div class="order-header">
          <span class="order-number">Pedido ${esc(order.number)}</span>
          <span class="badge ${statusBadgeClass(order.status)}">${esc(order.status)}</span>
        </div>
        <div class="order-meta stack-sm">
          <span><strong style="font-size:1.1rem">${esc(order.customerName || 'Cliente')}</strong></span>
          <span style="font-size:1.05rem; font-weight:700;">
            ${order.items.map(i => `${i.qty} × ${esc(i.name)}`).join(', ')}
          </span>
          ${order.mode === 'delivery' ? `<span class="meta-line">${icon('pin', 15)}${esc(order.address)}</span>` : `<span class="meta-line">${icon('store', 15)}Recogida en el local</span>`}
          ${(order.addressReference || order.reference) ? `<span class="text-sm text-muted">Ref: ${esc(order.addressReference || order.reference)}</span>` : ''}
          <div class="row row-between mt-1">
            <span class="text-sm">${needsCollect ? 'Cobrar:' : 'Pago:'}</span>
            <span class="order-total">${money(order.totalCents)}</span>
          </div>
          ${order.paid ? '<span class="badge badge-green">Ya pagado</span>' : `<span class="badge badge-amber">Cobrar ${money(order.totalCents)}</span>`}
        </div>
        <div class="order-actions">
          ${maps ? `<a class="btn-primary btn-sm btn-lg" href="${maps}" target="_blank" rel="noreferrer" style="flex:1 1 100%">${icon('navigation', 16)} Abrir Google Maps</a>` : ''}
          ${order.status === 'Asignado' ? `<button class="btn-secondary btn-sm" data-status="${order.id}:En camino" style="flex:1">${icon('truck', 16)} Iniciar entrega</button>` : ''}
          ${clientWa ? `<a class="btn-outline btn-sm" href="${clientWa}" target="_blank" rel="noreferrer" style="flex:1">${icon('message', 16)} Cliente</a>` : ''}
          ${['Asignado', 'En camino'].includes(order.status) ? `
            <button class="btn-success btn-sm btn-lg" data-deliver="${order.id}" style="flex:1 1 100%">${icon('check', 16)} Marcar entregado</button>
            <button class="btn-danger btn-sm" data-fail="${order.id}" style="flex:1 1 100%">${icon('alert', 16)} Problema</button>
          ` : ''}
        </div>
      </div>
    </article>`;
}

/** Estado vacío genérico (iconHtml: SVG de icons.js) */
export function emptyState(iconHtml, title, message) {
  return `
    <div class="empty-state">
      <div class="empty-icon">${iconHtml}</div>
      <h3>${esc(title)}</h3>
      <p class="text-muted">${esc(message)}</p>
    </div>`;
}

/** Footer de la aplicación */
export function appFooter() {
  return `
    <footer class="app-footer">
      Panamá · <span class="status-dot ${navigator.onLine ? 'online' : 'offline'}"></span>${navigator.onLine ? 'Conectado' : 'Sin conexión'} · Demo local
    </footer>`;
}
