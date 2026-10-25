/**
 * views/admin.js — Vistas del módulo de administración.
 * Pedidos, reparto, productos, ventas, configuración, pedidos manuales.
 */

import {
  getState, setState, esc, money, uid, calcOrderTotal,
  nextOrderNumber, formatDate, statusBadgeClass, orderCardClass
} from '../store.js';
import { topbar, adminNav, adminOrderCard, emptyState, appFooter } from '../ui.js';
import { icon } from '../icons.js';
import { navigate, showToast, renderApp } from '../router.js';

// === PEDIDOS (MAIN) ===
export function adminOrders() {
  const s = getState();
  const pending = s.orders.filter(o => o.status === 'Pendiente');
  const inProgress = s.orders.filter(o => ['Aceptado', 'En preparación', 'Asignado', 'En camino', 'Listo para recoger'].includes(o.status));
  const completed = s.orders.filter(o => ['Entregado', 'Cancelado', 'Entrega fallida'].includes(o.status));
  const todayOrders = s.orders.filter(o => new Date(o.createdAt).toDateString() === new Date().toDateString());
  const todayTotal = todayOrders.reduce((sum, o) => sum + (o.status !== 'Cancelado' ? o.totalCents : 0), 0);
  const todayDelivered = todayOrders.filter(o => o.status === 'Entregado').length;

  return wrap(`
    <div class="section-title"><span class="icon">${icon('clipboard')}</span> Panel de pedidos</div>

    <!-- Stats rápidos -->
    <div class="grid grid-stats mb-1">
      <div class="stat-card">
        <div class="stat-value">${pending.length}</div>
        <div class="stat-label">${icon('inbox', 14)} Nuevos</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${inProgress.length}</div>
        <div class="stat-label">${icon('refresh', 14)} En proceso</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${todayDelivered}</div>
        <div class="stat-label">${icon('check', 14)} Entregados hoy</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${money(todayTotal)}</div>
        <div class="stat-label">${icon('chart', 14)} Ventas del día</div>
      </div>
    </div>

    <button class="btn-primary mb-1" data-nav="manual">${icon('plus', 16)} Registrar pedido telefónico</button>

    ${pending.length > 0 ? `
      <div class="section-title"><span class="icon">${icon('inbox')}</span> Pedidos nuevos (${pending.length})</div>
      <div class="grid">${pending.map(adminOrderCard).join('')}</div>
    ` : ''}

    ${inProgress.length > 0 ? `
      <div class="section-title mt-2"><span class="icon">${icon('refresh')}</span> En proceso (${inProgress.length})</div>
      <div class="grid">${inProgress.map(adminOrderCard).join('')}</div>
    ` : ''}

    ${completed.length > 0 ? `
      <div class="section-title mt-2"><span class="icon">${icon('history')}</span> Historial reciente</div>
      <div class="grid">${completed.slice(0, 5).map(adminOrderCard).join('')}</div>
    ` : ''}

    ${s.orders.length === 0 ? emptyState(icon('clipboard', 40), 'Sin pedidos aún', 'Los pedidos de los clientes aparecerán aquí.') : ''}
  `);
}

// === REPARTO ===
export function adminReparto() {
  const s = getState();
  const assigned = s.orders.filter(o => ['Asignado', 'En camino'].includes(o.status));
  const readyToAssign = s.orders.filter(o => ['Aceptado', 'En preparación'].includes(o.status));

  return wrap(`
    <div class="section-title"><span class="icon">${icon('truck')}</span> Gestión de reparto</div>

    ${assigned.length > 0 ? `
      <div class="section-title"><span class="icon">${icon('pin')}</span> En reparto (${assigned.length})</div>
      <div class="grid">${assigned.map(adminOrderCard).join('')}</div>
    ` : emptyState(icon('truck', 40), 'Sin entregas en curso', 'Asigna pedidos al repartidor desde la sección de pedidos.')}

    ${readyToAssign.length > 0 ? `
      <div class="section-title mt-2"><span class="icon">${icon('box')}</span> Listos para asignar (${readyToAssign.length})</div>
      <div class="grid">${readyToAssign.map(adminOrderCard).join('')}</div>
    ` : ''}

    <div class="section-title mt-2"><span class="icon">${icon('car')}</span> Vehículos</div>
    <div class="grid">
      ${s.vehicles.map(v => `
        <div class="card row row-between">
          <div class="stack-sm">
            <strong>${esc(v.name)}</strong>
            <span class="text-sm text-muted">Placa: ${esc(v.plate || 'Sin placa')}</span>
            ${v.maintenance ? `<span class="text-xs text-muted">Mantenimiento: ${esc(v.maintenance)}</span>` : '<span class="text-xs text-muted">Mantenimiento: pendiente de registrar</span>'}
          </div>
          <button class="btn-sm ${v.active ? 'btn-danger' : 'btn-success'}" data-toggle-vehicle="${esc(v.id)}">${v.active ? 'Desactivar' : 'Activar'}</button>
        </div>
      `).join('')}
    </div>
    <section class="card stack mt-1">
      <h2 style="font-size:1rem;font-weight:800;">Agregar vehículo</h2>
      <p class="text-sm text-muted">Registra cada camión para asignarlo a las entregas.</p>
      <div class="field"><label for="vehicle-name">Nombre del camión</label><input id="vehicle-name" placeholder="Camión principal"></div>
      <div class="field"><label for="vehicle-plate">Placa</label><input id="vehicle-plate" placeholder="ABC-123"></div>
      <div class="field"><label for="vehicle-maintenance">Mantenimiento <span class="text-muted">(opcional)</span></label><input id="vehicle-maintenance" placeholder="Cambio de aceite · 25/10/2026"></div>
      <button class="btn-primary" id="btn-add-vehicle">${icon('plus', 16)} Agregar camión</button>
    </section>
  `);
}

// === PRODUCTOS ===
export function adminProducts() {
  const s = getState();
  return wrap(`
    <div class="section-title"><span class="icon">${icon('box')}</span> Administrar productos</div>
    <div class="grid">
      ${s.products.map(p => `
        <article class="card stack">
          <div class="row row-between">
            <div class="stack-sm">
              <strong>${esc(p.name)}</strong>
              <span class="text-sm text-muted">${esc(p.type)}</span>
            </div>
            <span class="badge ${p.available ? 'badge-green' : 'badge-red'}">${p.available ? 'Activo' : 'Pausado'}</span>
          </div>
          <div class="row row-between">
            <div class="field" style="flex:1;max-width:140px;">
              <label>Precio (B/.)</label>
              <input type="number" step="0.01" min="0" data-product-price="${p.id}" value="${(p.priceCents / 100).toFixed(2)}">
            </div>
            <button class="btn-sm ${p.available ? 'btn-danger' : 'btn-success'}" data-toggle-product="${p.id}">
              ${p.available ? icon('pause', 14) + ' Pausar' : icon('play', 14) + ' Activar'}
            </button>
          </div>
        </article>
      `).join('')}
    </div>
    <button class="btn-primary btn-full mt-1" id="btn-save-products">${icon('save', 16)} Guardar precios</button>
    <p class="text-xs text-muted text-center mt-1">Los cambios de precio solo afectan a pedidos nuevos. Los pedidos anteriores conservan sus precios originales.</p>
  `);
}

// === VENTAS ===
export function adminVentas() {
  const s = getState();
  const period = s.salesPeriod || 'today';
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  if (period === 'week') start.setDate(start.getDate() - 6);
  if (period === 'month') start.setDate(1);
  if (period === 'all') start.setTime(0);
  const periodOrders = s.orders.filter(o => new Date(o.createdAt) >= start);
  const delivered = periodOrders.filter(o => o.status === 'Entregado');
  const cancelled = periodOrders.filter(o => o.status === 'Cancelado');

  const totalAgua = delivered.reduce((sum, o) => sum + o.subtotalCents, 0);
  const totalEnvio = delivered.reduce((sum, o) => sum + o.shippingCents, 0);
  const totalVentas = delivered.reduce((sum, o) => sum + o.totalCents, 0);
  const totalBotellones = delivered.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.qty, 0), 0);
  const efectivoCobrado = delivered.filter(o => o.payment === 'Efectivo al recibir' && o.paid).reduce((sum, o) => sum + o.totalCents, 0);
  const efectivoPendiente = delivered.filter(o => o.payment === 'Efectivo al recibir' && !o.paid).reduce((sum, o) => sum + o.totalCents, 0);
  const digitalConfirmado = delivered.filter(o => o.payment !== 'Efectivo al recibir' && o.paid).reduce((sum, o) => sum + o.totalCents, 0);

  return wrap(`
    <div class="section-title"><span class="icon">${icon('chart')}</span> Reporte de ventas</div>
    <div class="field" style="max-width:280px;">
      <label for="sales-period">Período</label>
      <select id="sales-period">
        <option value="today" ${period === 'today' ? 'selected' : ''}>Hoy</option>
        <option value="week" ${period === 'week' ? 'selected' : ''}>Últimos 7 días</option>
        <option value="month" ${period === 'month' ? 'selected' : ''}>Este mes</option>
        <option value="all" ${period === 'all' ? 'selected' : ''}>Todo el historial</option>
      </select>
    </div>

    <div class="grid grid-stats mb-1">
      <div class="stat-card">
        <div class="stat-value">${money(totalVentas)}</div>
        <div class="stat-label">Total ventas</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalBotellones}</div>
        <div class="stat-label">Garrafones vendidos</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${delivered.length}</div>
        <div class="stat-label">Pedidos entregados</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${cancelled.length}</div>
        <div class="stat-label">Cancelados</div>
      </div>
    </div>

    <div class="card stack">
      <h2 style="font-size:1rem;font-weight:800;">Desglose de ingresos</h2>
      <div class="summary-row">
        <span>${icon('droplet', 15)} Importe del agua</span>
        <strong>${money(totalAgua)}</strong>
      </div>
      <div class="summary-row">
        <span>${icon('truck', 15)} Tarifas de envío</span>
        <strong>${money(totalEnvio)}</strong>
      </div>
      <hr class="divider">
      <div class="summary-row">
        <span>${icon('wallet', 15)} Efectivo cobrado</span>
        <strong class="badge badge-green">${money(efectivoCobrado)}</strong>
      </div>
      <div class="summary-row">
        <span>${icon('clock', 15)} Efectivo pendiente</span>
        <strong class="badge badge-amber">${money(efectivoPendiente)}</strong>
      </div>
      <div class="summary-row">
        <span>${icon('card', 15)} Pagos digitales confirmados</span>
        <strong class="badge badge-green">${money(digitalConfirmado)}</strong>
      </div>
      <hr class="divider">
      <div class="summary-row total">
        <span>Total del período</span>
        <strong>${money(totalVentas)}</strong>
      </div>
    </div>

    <div class="card stack mt-1">
      <h2 style="font-size:1rem;font-weight:800;">Resultado</h2>
      <div class="summary-row"><span>Ventas cobradas</span><strong>${money(efectivoCobrado + digitalConfirmado)}</strong></div>
      <div class="summary-row"><span>Pagos pendientes</span><strong class="badge badge-amber">${money(efectivoPendiente)}</strong></div>
      <p class="text-xs text-muted">Esto muestra ventas y cobros. Para calcular ganancia neta faltan registrar costos de agua, combustible, salarios y mantenimiento.</p>
    </div>

    ${delivered.length > 0 ? `
      <div class="section-title mt-2"><span class="icon">${icon('check')}</span> Pedidos entregados hoy</div>
      <div class="grid">
        ${delivered.map(o => `
          <div class="card row row-between">
            <div class="stack-sm">
              <strong>Pedido ${esc(o.number)}</strong>
              <span class="text-sm">${o.items.map(i => `${i.qty}× ${esc(i.name)}`).join(', ')}</span>
              <span class="text-xs text-muted">${esc(o.customerName)} · ${formatDate(o.createdAt)}</span>
            </div>
            <div class="stack-sm" style="text-align:right">
              <span class="font-bold">${money(o.totalCents)}</span>
              <span class="badge ${o.paid ? 'badge-green' : 'badge-amber'}">${o.paid ? 'Pagado' : 'Pendiente'}</span>
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `);
}

// === CONFIGURACIÓN ===
export function adminConfig() {
  const s = getState();
  return wrap(`
    <div class="section-title"><span class="icon">${icon('settings')}</span> Configuración del negocio</div>

    <div class="split-layout">
      <section class="card stack">
        <h2 style="font-size:1rem;font-weight:800;">Datos del negocio</h2>
        <div class="field">
          <label for="cfg-name">Nombre del negocio</label>
          <input id="cfg-name" value="${esc(s.settings.businessName)}">
        </div>
        <div class="field">
          <label for="cfg-shipping">Tarifa de envío por pedido a domicilio (B/.)</label>
          <input id="cfg-shipping" type="number" step="0.01" min="0" value="${(s.settings.shippingCents / 100).toFixed(2)}">
        </div>
        <div class="field">
          <label for="cfg-whatsapp">Número de WhatsApp del negocio</label>
          <input id="cfg-whatsapp" value="${esc(s.settings.whatsapp)}" placeholder="507XXXXXXXX">
        </div>
        <div class="field">
          <label for="cfg-pickup">Instrucciones para recogida en el local</label>
          <textarea id="cfg-pickup" rows="3">${esc(s.settings.storePickup)}</textarea>
        </div>
        <div class="field">
          <label>
            <input type="checkbox" id="cfg-pickup-enabled" ${s.settings.pickupEnabled ? 'checked' : ''}>
            Permitir recogida en el local
          </label>
        </div>
        <button class="btn-primary" id="btn-save-config">${icon('save', 16)} Guardar configuración</button>
        <p class="text-xs text-muted">La tarifa y precios solo afectan pedidos nuevos. Los pedidos anteriores conservan sus importes.</p>
      </section>

      <section class="card stack">
        <h2 style="font-size:1rem;font-weight:800;">Integraciones</h2>
        <div class="card" style="background:var(--amber-50);border:1px solid var(--amber-100);">
          <p class="text-sm">${icon('card', 16)} <strong>Yappy</strong></p>
          <p class="text-xs text-muted">Pendiente de configuración. Se necesitan las credenciales comerciales de Yappy.</p>
        </div>
        <div class="card" style="background:var(--amber-50);border:1px solid var(--amber-100);">
          <p class="text-sm">${icon('message', 16)} <strong>WhatsApp Business API</strong></p>
          <p class="text-xs text-muted">Pendiente. La comunicación actual funciona con enlaces wa.me. Para automatización se necesitan credenciales de la plataforma oficial.</p>
        </div>
        <div class="card" style="background:var(--green-50);border:1px solid var(--green-100);">
          <p class="text-sm">${icon('pin', 16)} <strong>Google Maps</strong></p>
          <p class="text-xs text-muted">${icon('check', 13)} Funcional. Se usan enlaces de navegación directa.</p>
        </div>
      </section>
    </div>
  `);
}

// === PEDIDO MANUAL ===
export function adminManual() {
  const s = getState();
  return wrap(`
    <div class="section-title"><span class="icon">${icon('phone')}</span> Registrar pedido telefónico / WhatsApp</div>

    <section class="card stack" style="max-width:560px;">
      <p class="text-sm text-muted">Registra aquí los pedidos que recibas por teléfono o WhatsApp para que entren al sistema y se calculen los precios correctamente.</p>

      <div class="field">
        <label for="manual-name">Nombre del cliente</label>
        <input id="manual-name" placeholder="Nombre completo">
      </div>
      <div class="field">
        <label for="manual-phone">Teléfono</label>
        <input id="manual-phone" placeholder="6000-0000">
      </div>
      <hr class="divider">
      <h3 style="font-size:0.95rem;font-weight:700;">Productos</h3>
      ${s.products.filter(p => p.available).map(p => `
        <div class="row row-between">
          <div class="stack-sm">
            <strong>${esc(p.name)}</strong>
            <span class="text-sm text-muted">${money(p.priceCents)} cada uno</span>
          </div>
          <div class="qty-stepper">
            <button data-manual-dec="${p.id}">−</button>
            <span class="qty-value" id="manual-qty-${p.id}">0</span>
            <button data-manual-inc="${p.id}">+</button>
          </div>
        </div>
      `).join('')}
      <hr class="divider">
      <div class="field">
        <label for="manual-mode">Modalidad</label>
        <select id="manual-mode">
          <option value="delivery">Entrega a domicilio</option>
          ${s.settings.pickupEnabled ? `<option value="pickup">Recogida en el local</option>` : ''}
        </select>
      </div>
      <div class="field" id="manual-address-field">
        <label for="manual-address">Dirección de entrega</label>
        <textarea id="manual-address" rows="2" placeholder="Barriada, calle, casa..."></textarea>
      </div>
      <div class="field">
        <label for="manual-payment">Forma de pago</label>
        <select id="manual-payment">
          <option value="Efectivo al recibir">Efectivo al recibir</option>
        </select>
      </div>

      <div id="manual-summary" class="card" style="background:var(--blue-50);">
        <div class="summary-row"><span>Agua</span><strong id="manual-sum-agua">B/. 0.00</strong></div>
        <div class="summary-row"><span>Envío</span><strong id="manual-sum-envio">${money(s.settings.shippingCents)}</strong></div>
        <div class="summary-row total"><span>Total</span><strong id="manual-sum-total">${money(s.settings.shippingCents)}</strong></div>
      </div>

      <button class="btn-primary btn-lg btn-full" id="btn-save-manual">${icon('check')} Crear pedido</button>
    </section>
  `);
}

// === WRAPPER ===
function wrap(content) {
  return `
    <div class="app">
      ${topbar()}
      <div class="content">${content}</div>
      ${adminNav()}
      ${appFooter()}
    </div>`;
}

// === EVENT BINDING ===
export function bindAdminEvents() {
  const s = getState();

  // Status changes
  document.querySelectorAll('[data-status]').forEach(btn => {
    btn.onclick = () => {
      const [id, newStatus] = btn.dataset.status.split(':');
      const order = s.orders.find(o => o.id === id);
      if (!order) return;
      const prev = order.status;
      order.status = newStatus;
      if (!order.events) order.events = [];
      order.events.push({ status: newStatus, from: prev, at: new Date().toISOString(), by: s.role });
      setState({ orders: s.orders });
      showToast(`Pedido ${order.number}: ${newStatus}`, 'success');
      renderApp();
    };
  });

  // Vehicle availability
  document.querySelectorAll('[data-toggle-vehicle]').forEach(btn => {
    btn.onclick = () => {
      const vehicle = s.vehicles.find(v => v.id === btn.dataset.toggleVehicle);
      if (!vehicle) return;
      vehicle.active = !vehicle.active;
      setState({ vehicles: s.vehicles });
      showToast(`${vehicle.name}: ${vehicle.active ? 'Activo' : 'Inactivo'}`, 'info');
      renderApp();
    };
  });

  const addVehicleBtn = document.getElementById('btn-add-vehicle');
  if (addVehicleBtn) {
    addVehicleBtn.onclick = () => {
      const name = document.getElementById('vehicle-name')?.value.trim();
      const plate = document.getElementById('vehicle-plate')?.value.trim();
      const maintenance = document.getElementById('vehicle-maintenance')?.value.trim();
      if (!name) { showToast('Escribe el nombre del camión', 'error'); return; }
      setState({ vehicles: [...s.vehicles, { id: uid(), name, plate, maintenance, active: true }] });
      showToast('Camión agregado', 'success');
      renderApp();
    };
  }

  const salesPeriod = document.getElementById('sales-period');
  if (salesPeriod) salesPeriod.onchange = () => { setState({ salesPeriod: salesPeriod.value }); renderApp(); };

  // Assign courier
  document.querySelectorAll('[data-assign]').forEach(btn => {
    btn.onclick = () => {
      const order = s.orders.find(o => o.id === btn.dataset.assign);
      if (!order) return;
      const prev = order.status;
      order.status = 'Asignado';
      order.assignedTo = 'repartidor';
      if (!order.events) order.events = [];
      order.events.push({ status: 'Asignado', from: prev, at: new Date().toISOString(), by: 'admin' });
      setState({ orders: s.orders });
      showToast(`Pedido ${order.number} asignado al repartidor`, 'success');
      renderApp();
    };
  });

  // Register payment (admin manual override, e.g. cash collected at the store)
  document.querySelectorAll('[data-paid]').forEach(btn => {
    btn.onclick = () => {
      const order = s.orders.find(o => o.id === btn.dataset.paid);
      if (!order) return;
      order.paid = !order.paid;
      if (!order.events) order.events = [];
      order.events.push({ status: order.status, at: new Date().toISOString(), by: s.role, paid: order.paid });
      setState({ orders: s.orders });
      showToast(order.paid ? `Pago de ${order.number} registrado` : `Pago de ${order.number} anulado`, order.paid ? 'success' : 'info');
      renderApp();
    };
  });

  // Toggle product availability
  document.querySelectorAll('[data-toggle-product]').forEach(btn => {
    btn.onclick = () => {
      const product = s.products.find(p => p.id === btn.dataset.toggleProduct);
      if (!product) return;
      product.available = !product.available;
      setState({ products: s.products });
      showToast(`${product.name}: ${product.available ? 'Activado' : 'Pausado'}`, 'info');
      renderApp();
    };
  });

  // Save products prices
  const saveProductsBtn = document.getElementById('btn-save-products');
  if (saveProductsBtn) {
    saveProductsBtn.onclick = () => {
      document.querySelectorAll('[data-product-price]').forEach(input => {
        const product = s.products.find(p => p.id === input.dataset.productPrice);
        if (product) {
          product.priceCents = Math.round(Number(input.value || 0) * 100);
        }
      });
      setState({ products: s.products });
      showToast('Precios actualizados', 'success');
      renderApp();
    };
  }

  // Save config
  const saveConfigBtn = document.getElementById('btn-save-config');
  if (saveConfigBtn) {
    saveConfigBtn.onclick = () => {
      const settings = {
        ...s.settings,
        businessName: document.getElementById('cfg-name')?.value.trim() || 'Agua Clara',
        shippingCents: Math.round(Number(document.getElementById('cfg-shipping')?.value || 0) * 100),
        whatsapp: document.getElementById('cfg-whatsapp')?.value.replace(/\D/g, '') || '',
        storePickup: document.getElementById('cfg-pickup')?.value.trim() || '',
        pickupEnabled: document.getElementById('cfg-pickup-enabled')?.checked ?? true,
      };
      setState({ settings });
      showToast('Configuración guardada', 'success');
      renderApp();
    };
  }

  // Manual order quantities
  const manualQtys = {};
  s.products.forEach(p => { manualQtys[p.id] = 0; });

  document.querySelectorAll('[data-manual-inc]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.manualInc;
      manualQtys[id] = (manualQtys[id] || 0) + 1;
      const el = document.getElementById(`manual-qty-${id}`);
      if (el) el.textContent = manualQtys[id];
      updateManualSummary(manualQtys);
    };
  });
  document.querySelectorAll('[data-manual-dec]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.manualDec;
      manualQtys[id] = Math.max(0, (manualQtys[id] || 0) - 1);
      const el = document.getElementById(`manual-qty-${id}`);
      if (el) el.textContent = manualQtys[id];
      updateManualSummary(manualQtys);
    };
  });

  // Manual mode toggle
  const manualMode = document.getElementById('manual-mode');
  if (manualMode) {
    manualMode.onchange = () => {
      const addrField = document.getElementById('manual-address-field');
      if (addrField) addrField.classList.toggle('hidden', manualMode.value !== 'delivery');
      updateManualSummary(manualQtys);
    };
  }

  // Save manual order
  const saveManualBtn = document.getElementById('btn-save-manual');
  if (saveManualBtn) {
    saveManualBtn.onclick = () => {
      const name = document.getElementById('manual-name')?.value.trim();
      const phone = document.getElementById('manual-phone')?.value.trim();
      const mode = document.getElementById('manual-mode')?.value || 'delivery';
      const address = document.getElementById('manual-address')?.value.trim() || '';
      const payment = document.getElementById('manual-payment')?.value || 'Efectivo al recibir';

      if (!name) { showToast('Escribe el nombre del cliente', 'error'); return; }

      const items = [];
      s.products.forEach(p => {
        const qty = manualQtys[p.id] || 0;
        if (qty > 0) {
          items.push({ id: p.id, name: p.name, priceCents: p.priceCents, qty, type: p.type });
        }
      });

      if (items.length === 0) { showToast('Agrega al menos un producto', 'error'); return; }
      if (mode === 'delivery' && !address) { showToast('Escribe la dirección de entrega', 'error'); return; }

      const { subtotal, shipping, total } = calcOrderTotal(items, mode, s.settings.shippingCents);

      const order = {
        id: uid(),
        number: nextOrderNumber(),
        items,
        subtotalCents: subtotal,
        shippingCents: shipping,
        totalCents: total,
        mode,
        address: mode === 'delivery' ? address : '',
        payment,
        paid: false,
        status: 'Pendiente',
        source: 'Teléfono/WhatsApp',
        customerName: name,
        customerPhone: phone,
        createdAt: new Date().toISOString(),
        events: [{ status: 'Pendiente', at: new Date().toISOString(), by: 'admin' }],
      };

      s.orders.unshift(order);
      setState({ orders: s.orders, view: 'admin' });
      showToast(`Pedido ${order.number} creado`, 'success');
      renderApp();
    };
  }
}

function updateManualSummary(qtys) {
  const s = getState();
  const mode = document.getElementById('manual-mode')?.value || 'delivery';
  let subtotal = 0;
  s.products.forEach(p => {
    subtotal += (qtys[p.id] || 0) * p.priceCents;
  });
  const shipping = mode === 'delivery' ? s.settings.shippingCents : 0;
  const total = subtotal + shipping;

  const elAgua = document.getElementById('manual-sum-agua');
  const elEnvio = document.getElementById('manual-sum-envio');
  const elTotal = document.getElementById('manual-sum-total');
  if (elAgua) elAgua.textContent = money(subtotal);
  if (elEnvio) elEnvio.textContent = money(shipping);
  if (elTotal) elTotal.textContent = money(total);
}
