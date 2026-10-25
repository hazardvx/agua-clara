/**
 * views/cliente.js — Vistas del módulo del cliente.
 * Inicio, catálogo, carrito/checkout, pedidos e historial, cuenta.
 */

import {
  getState, setState, esc, money, uid, calcOrderTotal,
  nextOrderNumber, addToCart, updateCartQty, removeFromCart,
  clearCart, formatDate, cartCount, statusBadgeClass, customerOrders
} from '../store.js';
import { updateAccountProfile } from '../auth.js';
import { topbar, clientNav, hero, productCard, clientOrderCard, emptyState, appFooter } from '../ui.js';
import { icon } from '../icons.js';
import { navigate, showToast, renderApp } from '../router.js';

// === HOME ===
export function clientHome() {
  const s = getState();
  const available = s.products.filter(p => p.available);
  const myOrders = customerOrders(s.orders, s.user.id);
  return wrap(`
    ${hero()}
    <div class="section-title"><span class="icon">${icon('droplet')}</span> Nuestros productos</div>
    <div class="grid grid-2">
      ${available.map(productCard).join('')}
    </div>
    ${myOrders.length > 0 ? `
      <div class="section-title mt-2"><span class="icon">${icon('clipboard')}</span> Últimos pedidos</div>
      <div class="grid">
        ${myOrders.slice(0, 2).map(clientOrderCard).join('')}
      </div>
      <button class="btn-outline btn-full mt-1" data-nav="pedidos">Ver todos mis pedidos</button>
    ` : ''}
  `);
}

// === CATALOG ===
export function clientCatalog() {
  const s = getState();
  const available = s.products.filter(p => p.available);
  const count = cartCount();
  return wrap(`
    <div class="section-title"><span class="icon">${icon('droplet')}</span> Elige tu agua</div>
    <div class="grid grid-2">
      ${available.map(productCard).join('')}
    </div>
    ${count > 0 ? `
      <div class="mt-2">
        <button class="btn-primary btn-lg btn-full" data-nav="carrito">
          ${icon('cart')} Ver carrito (${count} ${count === 1 ? 'garrafón' : 'garrafones'})
        </button>
      </div>
    ` : ''}
  `);
}

// === CART & CHECKOUT ===
export function clientCart() {
  const s = getState();
  const { subtotal, shipping, total } = calcOrderTotal(s.cart, 'delivery', s.settings.shippingCents);

  if (s.cart.length === 0) {
    return wrap(`
      ${emptyState(icon('cart', 40), 'Tu carrito está vacío', 'Agrega garrafones desde el catálogo.')}
      <button class="btn-primary btn-lg btn-full" data-nav="catalogo">${icon('droplet')} Ver productos</button>
    `);
  }

  return wrap(`
    <div class="section-title"><span class="icon">${icon('cart')}</span> Confirmar pedido</div>

    <!-- Progress steps -->
    <div class="checkout-steps">
      <div class="step-indicator active"></div>
      <div class="step-indicator"></div>
      <div class="step-indicator"></div>
    </div>

    <div class="split-layout">
      <div class="stack stack-lg">
        <!-- Productos -->
        <section class="card stack">
          <h2 style="font-size:1rem;font-weight:800;">1. Tus productos</h2>
          ${s.cart.map(item => `
            <div class="row row-between">
              <div class="stack-sm" style="flex:1">
                <strong>${esc(item.name)}</strong>
                <span class="text-sm text-muted">${money(item.priceCents)} cada uno</span>
              </div>
              <div class="qty-stepper">
                <button data-dec="${item.id}" aria-label="Reducir cantidad">−</button>
                <span class="qty-value">${item.qty}</span>
                <button data-inc="${item.id}" aria-label="Aumentar cantidad">+</button>
              </div>
              <button class="btn-danger btn-sm" data-remove="${item.id}" aria-label="Quitar">${icon('x', 16)}</button>
            </div>
          `).join('')}
          <button class="btn-outline btn-sm" data-nav="catalogo">+ Agregar más</button>
        </section>

        <!-- Modalidad -->
        <section class="card stack">
          <h2 style="font-size:1rem;font-weight:800;">2. ¿Cómo quieres recibirlo?</h2>
          <div class="field">
            <label for="checkout-mode">Modalidad de entrega</label>
            <select id="checkout-mode">
              <option value="delivery">Entrega a domicilio (+${money(s.settings.shippingCents)})</option>
              ${s.settings.pickupEnabled ? `<option value="pickup">Recogida en el local (gratis)</option>` : ''}
            </select>
          </div>

          <!-- Address field -->
          <div id="address-section">
            <div class="field">
              <label for="checkout-saved-address">Dirección guardada</label>
              <select id="checkout-saved-address">
                <option value="">Escribir una dirección nueva</option>
                ${s.addresses.map(a => `<option value="${esc(a.id)}">${esc(a.label)} — ${esc(a.text)}</option>`).join('')}
              </select>
            </div>
            <div class="field mt-1">
              <label for="checkout-address">Dirección y referencia</label>
              <textarea id="checkout-address" rows="2" placeholder="Ej: Barriada, calle, casa, portón...">${esc(s.addresses[0]?.text || '')}</textarea>
            </div>
            <div class="field mt-1">
              <label for="checkout-reference">Referencia para encontrarla <span class="text-muted">(opcional)</span></label>
              <input id="checkout-reference" placeholder="Portón azul, frente al parque..." value="${esc(s.addresses[0]?.reference || '')}">
            </div>
            <div class="row mt-1" style="align-items:center;flex-wrap:wrap;gap:.6rem;">
              <button class="btn-outline btn-sm" type="button" id="btn-use-location">${icon('pin', 16)} Usar mi ubicación</button>
              <span id="location-status" class="text-xs text-muted" role="status" aria-live="polite">${s.checkoutLocation ? 'Ubicación lista para este pedido.' : 'El GPS es opcional; puedes escribir la dirección.'}</span>
            </div>
          </div>

          <!-- Pickup note -->
          <div id="pickup-section" class="hidden">
            <div class="card" style="background:var(--blue-50);border:1px solid var(--blue-200);">
              <p class="text-sm">${icon('pin', 15)} <strong>Lugar de recogida:</strong></p>
              <p class="text-sm">${esc(s.settings.storePickup)}</p>
            </div>
          </div>
        </section>

        <!-- Pago -->
        <section class="card stack">
          <h2 style="font-size:1rem;font-weight:800;">3. Forma de pago</h2>
          <div class="field">
            <label for="checkout-payment">¿Cómo deseas pagar?</label>
            <select id="checkout-payment">
              <option value="Efectivo al recibir">Efectivo al recibir</option>
              <option value="Yappy" disabled>Yappy (pendiente de configuración)</option>
            </select>
          </div>
        </section>
      </div>

      <!-- Resumen lateral -->
      <div class="stack">
        <section class="card stack" id="checkout-summary">
          <h2 style="font-size:1rem;font-weight:800;">Resumen del pedido</h2>
          ${s.cart.map(item => `
            <div class="summary-row">
              <span>${item.qty} × ${esc(item.name)}</span>
              <strong>${money(item.qty * item.priceCents)}</strong>
            </div>
          `).join('')}
          <hr class="divider">
          <div class="summary-row">
            <span>Agua</span>
            <strong id="sum-subtotal">${money(subtotal)}</strong>
          </div>
          <div class="summary-row">
            <span>Envío</span>
            <strong id="sum-shipping">${money(shipping)}</strong>
          </div>
          <div class="summary-row total">
            <span>Total</span>
            <strong id="sum-total">${money(total)}</strong>
          </div>
          <button class="btn-primary btn-lg btn-full" id="btn-confirm-order">
            ${icon('check')} Confirmar pedido — ${money(total)}
          </button>
          <p class="text-xs text-muted text-center">Al confirmar aceptas que el precio puede variar si cambia la disponibilidad.</p>
        </section>
      </div>
    </div>
  `);
}

// === CONFIRMATION ===
export function clientConfirmation() {
  const s = getState();
  const order = customerOrders(s.orders, s.user.id)[0];
  if (!order) return clientHome();
  const wa = `https://wa.me/${s.settings.whatsapp}?text=${encodeURIComponent(`Hola, acabo de realizar el pedido ${order.number}.`)}`;
  return wrap(`
    <div class="confirmation">
      <div class="check-icon">${icon('check', 34)}</div>
      <h1 style="font-size:1.5rem;font-weight:900;margin-bottom:0.5rem;">¡Pedido confirmado!</h1>
      <p class="text-muted mb-1">Tu pedido ha sido registrado correctamente.</p>

      <div class="card stack" style="text-align:left;max-width:420px;margin:0 auto;">
        <div class="row row-between">
          <span class="font-bold">Número de pedido</span>
          <span class="badge badge-blue font-bold">${esc(order.number)}</span>
        </div>
        <hr class="divider">
        ${order.items.map(i => `
          <div class="summary-row">
            <span>${i.qty} × ${esc(i.name)}</span>
            <strong>${money(i.qty * i.priceCents)}</strong>
          </div>
        `).join('')}
        <hr class="divider">
        <div class="summary-row">
          <span>Agua</span>
          <strong>${money(order.subtotalCents)}</strong>
        </div>
        <div class="summary-row">
          <span>Envío</span>
          <strong>${money(order.shippingCents)}</strong>
        </div>
        <div class="summary-row total">
          <span>Total</span>
          <strong>${money(order.totalCents)}</strong>
        </div>
        <hr class="divider">
        <div class="summary-row">
          <span>Modalidad</span>
          <strong>${order.mode === 'delivery' ? icon('home', 15) + ' Entrega a domicilio' : icon('store', 15) + ' Recogida'}</strong>
        </div>
        ${order.address ? `
        <div class="summary-row">
          <span>Dirección</span>
          <span>${esc(order.address)}</span>
        </div>` : ''}
        <div class="summary-row">
          <span>Pago</span>
          <strong>${esc(order.payment)}</strong>
        </div>
        <div class="summary-row">
          <span>Estado</span>
          <span class="badge ${statusBadgeClass(order.status)}">${esc(order.status)}</span>
        </div>
      </div>

      <div class="row mt-2" style="justify-content:center;">
        <a class="btn-secondary" href="${wa}" target="_blank" rel="noreferrer">${icon('message')} Escribir al negocio</a>
        <button class="btn-primary" data-nav="pedidos">${icon('clipboard')} Ver mis pedidos</button>
      </div>
    </div>
  `);
}

// === ORDERS ===
export function clientOrders() {
  const s = getState();
  const list = customerOrders(s.orders, s.user.id);
  return wrap(`
    <div class="section-title"><span class="icon">${icon('clipboard')}</span> Mis pedidos</div>
    ${list.length > 0 ?
      `<div class="grid">${list.map(clientOrderCard).join('')}</div>` :
      emptyState(icon('clipboard', 40), 'Aún no tienes pedidos', 'Haz tu primer pedido y aquí verás tu historial.')
    }
  `);
}

// === ACCOUNT ===
export function clientAccount() {
  const s = getState();
  return wrap(`
    <div class="section-title"><span class="icon">${icon('user')}</span> Mi cuenta</div>
    <div class="split-layout">
      <section class="card stack">
        <h2 style="font-size:1rem;font-weight:800;">Mis datos</h2>
        <div class="field">
          <label for="profile-name">Nombre</label>
          <input id="profile-name" value="${esc(s.user.name)}" placeholder="Tu nombre completo">
        </div>
        <div class="field">
          <label for="profile-phone">Teléfono</label>
          <input id="profile-phone" value="${esc(s.user.phone)}" placeholder="6000-0000">
        </div>
        <div class="field">
          <label for="profile-email">Correo electrónico</label>
          <input id="profile-email" type="email" value="${esc(s.user.email)}" placeholder="correo@ejemplo.com">
        </div>
        <button class="btn-primary" id="btn-save-profile">Guardar datos</button>
      </section>

      <section class="card stack">
        <h2 style="font-size:1rem;font-weight:800;">Mis direcciones</h2>
        ${s.addresses.length > 0 ? s.addresses.map(a => `
          <div class="row row-between" style="padding:0.5rem 0;border-bottom:1px solid var(--border);">
            <div class="stack-sm">
              <strong>${esc(a.label)}</strong>
              <span class="text-sm text-muted">${esc(a.text)}</span>
              ${a.reference ? `<span class="text-xs text-muted">Ref: ${esc(a.reference)}</span>` : ''}
            </div>
            <button class="btn-danger btn-sm" data-remove-address="${a.id}" aria-label="Quitar dirección">${icon('x', 16)}</button>
          </div>
        `).join('') : '<p class="text-sm text-muted">No tienes direcciones guardadas.</p>'}

        <hr class="divider">
        <div class="field">
          <label for="new-address-label">Nombre de la dirección</label>
          <input id="new-address-label" placeholder="Ej: Mi casa, Trabajo...">
        </div>
        <div class="field">
          <label for="new-address-text">Dirección</label>
          <textarea id="new-address-text" rows="2" placeholder="Barriada, calle, casa..."></textarea>
        </div>
        <div class="field">
          <label for="new-address-ref">Referencia (opcional)</label>
          <input id="new-address-ref" placeholder="Portón azul, frente al parque...">
        </div>
        <button class="btn-secondary" id="btn-save-address">${icon('plus', 16)} Guardar dirección</button>
      </section>
    </div>
  `);
}

// === WRAPPERS & BINDING ===

function wrap(content) {
  return `
    <div class="app">
      ${topbar()}
      <div class="content">${content}</div>
      ${clientNav()}
      ${appFooter()}
    </div>`;
}

/** Vincula todos los eventos del módulo cliente */
export function bindClientEvents() {
  const s = getState();

  // Add to cart
  document.querySelectorAll('[data-add]').forEach(btn => {
    btn.onclick = () => {
      addToCart(btn.dataset.add);
      showToast('Agregado al carrito', 'success');
      renderApp();
    };
  });

  // Qty stepper
  document.querySelectorAll('[data-inc]').forEach(btn => {
    btn.onclick = () => { updateCartQty(btn.dataset.inc, 1); renderApp(); };
  });
  document.querySelectorAll('[data-dec]').forEach(btn => {
    btn.onclick = () => { updateCartQty(btn.dataset.dec, -1); renderApp(); };
  });
  document.querySelectorAll('[data-remove]').forEach(btn => {
    btn.onclick = () => { removeFromCart(btn.dataset.remove); renderApp(); };
  });

  // Repeat order
  document.querySelectorAll('[data-repeat]').forEach(btn => {
    btn.onclick = () => {
      const order = customerOrders(s.orders, s.user.id).find(o => o.id === btn.dataset.repeat);
      if (!order) return;
      // Rebuild cart from order items, using current prices
      const newCart = order.items.map(item => {
        const currentProduct = s.products.find(p => p.id === item.id);
        return {
          id: item.id,
          name: item.name,
          priceCents: currentProduct ? currentProduct.priceCents : item.priceCents,
          type: item.type || '',
          qty: item.qty,
        };
      });
      setState({ cart: newCart, view: 'carrito' });
      showToast('Pedido cargado en el carrito. Revisa cantidades y precios actuales.', 'info');
      renderApp();
    };
  });

  // Checkout mode toggle
  const modeSelect = document.getElementById('checkout-mode');
  if (modeSelect) {
    modeSelect.onchange = () => updateCheckoutTotals();
  }

  // Saved address
  const savedAddr = document.getElementById('checkout-saved-address');
  if (savedAddr) {
    savedAddr.onchange = () => {
      if (savedAddr.value) {
        const address = s.addresses.find(a => a.id === savedAddr.value);
        if (address) {
          document.getElementById('checkout-address').value = address.text;
          const reference = document.getElementById('checkout-reference');
          if (reference) reference.value = address.reference || '';
        }
      }
    };
  }

  const locationBtn = document.getElementById('btn-use-location');
  if (locationBtn) {
    locationBtn.onclick = () => {
      const status = document.getElementById('location-status');
      if (!navigator.geolocation) {
        if (status) status.textContent = 'Este navegador no ofrece ubicación. Escribe la dirección manualmente.';
        showToast('La ubicación no está disponible; escribe la dirección manualmente', 'info');
        return;
      }
      locationBtn.disabled = true;
      if (status) status.textContent = 'Solicitando permiso de ubicación…';
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          setState({ checkoutLocation: { latitude: coords.latitude, longitude: coords.longitude } });
          locationBtn.disabled = false;
          if (status) status.textContent = 'Ubicación lista para este pedido.';
          showToast('Ubicación guardada para este pedido', 'success');
        },
        (error) => {
          setState({ checkoutLocation: null });
          locationBtn.disabled = false;
          const message = error.code === 1
            ? 'Permiso denegado. Puedes continuar escribiendo la dirección.'
            : 'No se pudo obtener la ubicación. Puedes continuar manualmente.';
          if (status) status.textContent = message;
          showToast(message, 'info');
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    };
  }

  // Confirm order
  const confirmBtn = document.getElementById('btn-confirm-order');
  if (confirmBtn) {
    confirmBtn.onclick = () => confirmOrder();
  }

  // Save profile
  const saveProfileBtn = document.getElementById('btn-save-profile');
  if (saveProfileBtn) {
    saveProfileBtn.onclick = () => {
      const name = document.getElementById('profile-name')?.value.trim() || '';
      const phone = document.getElementById('profile-phone')?.value.trim() || '';
      const email = document.getElementById('profile-email')?.value.trim() || '';
      setState({ user: { ...s.user, name, phone, email } });
      updateAccountProfile({ name, phone });
      showToast('Datos guardados', 'success');
    };
  }

  // Save address
  const saveAddrBtn = document.getElementById('btn-save-address');
  if (saveAddrBtn) {
    saveAddrBtn.onclick = () => {
      const label = document.getElementById('new-address-label')?.value.trim();
      const text = document.getElementById('new-address-text')?.value.trim();
      const reference = document.getElementById('new-address-ref')?.value.trim();
      if (!text) { showToast('Escribe la dirección', 'error'); return; }
      const addresses = [...s.addresses, { id: uid(), label: label || `Dirección ${s.addresses.length + 1}`, text, reference }];
      setState({ addresses });
      showToast('Dirección guardada', 'success');
      renderApp();
    };
  }

  // Remove address
  document.querySelectorAll('[data-remove-address]').forEach(btn => {
    btn.onclick = () => {
      const addresses = s.addresses.filter(a => a.id !== btn.dataset.removeAddress);
      setState({ addresses });
      renderApp();
    };
  });
}

/** Actualiza los totales en el checkout cuando cambia la modalidad */
function updateCheckoutTotals() {
  const s = getState();
  const mode = document.getElementById('checkout-mode')?.value;
  const isDelivery = mode === 'delivery';
  const { subtotal, shipping, total } = calcOrderTotal(s.cart, mode, s.settings.shippingCents);

  const sumSubtotal = document.getElementById('sum-subtotal');
  const sumShipping = document.getElementById('sum-shipping');
  const sumTotal = document.getElementById('sum-total');
  const confirmBtn = document.getElementById('btn-confirm-order');

  if (sumSubtotal) sumSubtotal.textContent = money(subtotal);
  if (sumShipping) sumShipping.textContent = money(shipping);
  if (sumTotal) sumTotal.textContent = money(total);
  if (confirmBtn) confirmBtn.innerHTML = `${icon('check')} Confirmar pedido — ${money(total)}`;

  const addrSection = document.getElementById('address-section');
  const pickupSection = document.getElementById('pickup-section');
  if (addrSection) addrSection.classList.toggle('hidden', !isDelivery);
  if (pickupSection) pickupSection.classList.toggle('hidden', isDelivery);
}

/** Procesa la confirmación de un pedido */
function confirmOrder() {
  const s = getState();
  if (s.cart.length === 0) {
    showToast('Agrega al menos un garrafón', 'error');
    return;
  }

  // Confirmar pedido requiere una cuenta de cliente
  if (!s.isLoggedIn) {
    setState({ authReturnTo: 'carrito' });
    navigate('login');
    showToast('Inicia sesión para confirmar tu pedido', 'info');
    return;
  }

  const mode = document.getElementById('checkout-mode')?.value || 'delivery';
  const address = document.getElementById('checkout-address')?.value.trim() || '';
  const reference = document.getElementById('checkout-reference')?.value.trim() || '';
  const payment = document.getElementById('checkout-payment')?.value || 'Efectivo al recibir';

  if (mode === 'delivery' && !address) {
    showToast('Escribe una dirección para la entrega', 'error');
    return;
  }

  // Validar nombre/teléfono
  if (!s.user.name || !s.user.phone) {
    showToast('Completa tu nombre y teléfono en "Mi cuenta" antes de pedir', 'error');
    navigate('cuenta');
    return;
  }

  const { subtotal, shipping, total } = calcOrderTotal(s.cart, mode, s.settings.shippingCents);

  const order = {
    id: uid(),
    number: nextOrderNumber(),
    items: s.cart.map(({ id, name, priceCents, qty, type }) => ({ id, name, priceCents, qty, type })),
    subtotalCents: subtotal,
    shippingCents: shipping,
    totalCents: total,
    mode,
    address: mode === 'delivery' ? address : '',
    addressReference: mode === 'delivery' ? reference : '',
    payment,
    paid: false,
    status: 'Pendiente',
    source: 'Web',
    customerId: s.user.id || '',
    customerName: s.user.name,
    customerPhone: s.user.phone,
    customerEmail: s.user.email || '',
    createdAt: new Date().toISOString(),
    events: [{ status: 'Pendiente', at: new Date().toISOString(), by: 'cliente' }],
  };

  // Save address if new
  const location = mode === 'delivery' ? s.checkoutLocation : null;
  const savedAddress = mode === 'delivery' ? s.addresses.find(a => a.text === address) : null;
  if (mode === 'delivery' && address && !savedAddress) {
    s.addresses.push({ id: uid(), label: 'Última dirección', text: address, reference, ...(location || {}) });
  }

  const selectedAddress = mode === 'delivery' ? (savedAddress || s.addresses.find(a => a.text === address)) : null;
  order.addressId = selectedAddress?.id || null;
  order.latitude = location?.latitude ?? selectedAddress?.latitude ?? null;
  order.longitude = location?.longitude ?? selectedAddress?.longitude ?? null;

  s.orders.unshift(order);
  setState({ orders: s.orders, addresses: s.addresses, cart: [], checkoutLocation: null, view: 'confirmacion' });
  history.pushState(null, '', '#confirmacion');
  showToast('¡Pedido registrado!', 'success');
  renderApp();
}
