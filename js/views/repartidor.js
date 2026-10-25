/**
 * views/repartidor.js — Vistas del módulo del repartidor.
 * Lista de entregas asignadas, registro de entrega y cobro, historial.
 */

import {
  getState, setState, esc, money, uid, formatDate,
  statusBadgeClass, orderCardClass
} from '../store.js';
import { topbar, courierNav, courierDeliveryCard, emptyState, appFooter } from '../ui.js';
import { icon } from '../icons.js';
import { navigate, showToast, renderApp } from '../router.js';

// === MIS ENTREGAS ===
export function courierDeliveries() {
  const s = getState();
  const assigned = s.orders.filter(o =>
    o.assignedTo === 'repartidor' && ['Asignado', 'En camino'].includes(o.status)
  );
  const totalToCollect = assigned
    .filter(o => o.payment === 'Efectivo al recibir' && !o.paid)
    .reduce((sum, o) => sum + o.totalCents, 0);
  const totalBottles = assigned.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.qty, 0), 0);

  return wrap(`
    <div class="section-title"><span class="icon">${icon('pin')}</span> Mis entregas</div>

    ${assigned.length > 0 ? `
      <div class="grid grid-stats mb-1">
        <div class="stat-card">
          <div class="stat-value">${assigned.length}</div>
          <div class="stat-label">Entregas pendientes</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalBottles}</div>
          <div class="stat-label">Garrafones</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${money(totalToCollect)}</div>
          <div class="stat-label">Por cobrar</div>
        </div>
      </div>

      <div class="grid">
        ${assigned.map(courierDeliveryCard).join('')}
      </div>
    ` : emptyState(icon('pin', 40), 'Sin entregas asignadas', 'Cuando la administradora te asigne pedidos, aparecerán aquí.')}
  `);
}

// === HISTORIAL ===
export function courierHistory() {
  const s = getState();
  const completed = s.orders.filter(o =>
    o.assignedTo === 'repartidor' && ['Entregado', 'Entrega fallida'].includes(o.status)
  );

  const todayCompleted = completed.filter(o => new Date(o.createdAt).toDateString() === new Date().toDateString());
  const todayCollected = todayCompleted
    .filter(o => o.paid && o.payment === 'Efectivo al recibir')
    .reduce((sum, o) => sum + o.totalCents, 0);

  return wrap(`
    <div class="section-title"><span class="icon">${icon('history')}</span> Mi historial</div>

    <div class="grid grid-stats mb-1">
      <div class="stat-card">
        <div class="stat-value">${todayCompleted.length}</div>
        <div class="stat-label">Entregas hoy</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${money(todayCollected)}</div>
        <div class="stat-label">Efectivo cobrado hoy</div>
      </div>
    </div>

    ${completed.length > 0 ? `
      <div class="grid">
        ${completed.map(o => `
          <article class="card order-card ${orderCardClass(o.status)}">
            <div class="order-header">
              <span class="order-number">Pedido ${esc(o.number)}</span>
              <span class="badge ${statusBadgeClass(o.status)}">${esc(o.status)}</span>
            </div>
            <div class="order-meta">
              <span><strong>${esc(o.customerName || 'Cliente')}</strong></span>
              <span>${o.items.map(i => `${i.qty} × ${esc(i.name)}`).join(', ')}</span>
              <div class="row row-between">
                <span class="text-sm text-muted">${formatDate(o.createdAt)}</span>
                <span class="order-total">${money(o.totalCents)}</span>
              </div>
              <span class="text-sm">${o.paid ? icon('check', 14) + ' Cobrado' : icon('clock', 14) + ' Pago pendiente'}</span>
              ${o.emptyContainers ? `<span class="text-sm">${icon('rotate', 14)} Envases recogidos: ${o.emptyContainers}</span>` : ''}
              ${o.deliveryNotes ? `<span class="text-sm text-muted">Nota: ${esc(o.deliveryNotes)}</span>` : ''}
            </div>
          </article>
        `).join('')}
      </div>
    ` : emptyState(icon('history', 40), 'Sin entregas completadas', 'Tu historial de entregas aparecerá aquí.')}
  `);
}

// === WRAPPER ===
function wrap(content) {
  return `
    <div class="app">
      ${topbar()}
      <div class="content">${content}</div>
      ${courierNav()}
      ${appFooter()}
    </div>`;
}

// === EVENT BINDING ===
export function bindCourierEvents() {
  const s = getState();

  // Status changes (In transit)
  document.querySelectorAll('[data-status]').forEach(btn => {
    btn.onclick = () => {
      const [id, newStatus] = btn.dataset.status.split(':');
      const order = s.orders.find(o => o.id === id);
      if (!order) return;
      const prev = order.status;
      order.status = newStatus;
      if (!order.events) order.events = [];
      order.events.push({ status: newStatus, from: prev, at: new Date().toISOString(), by: 'repartidor' });
      setState({ orders: s.orders });
      showToast(`Pedido ${order.number}: ${newStatus}`, 'success');
      renderApp();
    };
  });

  // Mark as delivered (with optional cash collection)
  document.querySelectorAll('[data-deliver]').forEach(btn => {
    btn.onclick = () => {
      const order = s.orders.find(o => o.id === btn.dataset.deliver);
      if (!order) return;
      showDeliveryModal(order);
    };
  });

  // Report problem
  document.querySelectorAll('[data-fail]').forEach(btn => {
    btn.onclick = () => {
      const order = s.orders.find(o => o.id === btn.dataset.fail);
      if (!order) return;
      showFailureModal(order);
    };
  });
}

/** Modal para marcar entrega completada */
function showDeliveryModal(order) {
  const s = getState();
  const needsCash = order.payment === 'Efectivo al recibir' && !order.paid;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>${icon('check', 22)} Confirmar entrega</h2>
      <div class="stack">
        <p>Vas a marcar como entregado el <strong>Pedido ${esc(order.number)}</strong>.</p>
        <p class="text-sm">${order.items.map(i => `${i.qty} × ${esc(i.name)}`).join(', ')}</p>
        <p class="font-bold">Total: ${money(order.totalCents)}</p>

        ${needsCash ? `
          <div class="card" style="background:var(--amber-50);border:1px solid var(--amber-100);">
            <p class="text-sm font-bold">${icon('wallet', 15)} Cobro en efectivo</p>
            <label class="text-sm">
              <input type="checkbox" id="modal-cash-collected" checked>
              El cliente pagó ${money(order.totalCents)} en efectivo
            </label>
          </div>
        ` : `
          <div class="card" style="background:var(--green-50);border:1px solid var(--green-100);">
            <p class="text-sm badge badge-green">Pago ya registrado</p>
          </div>
        `}

        <div class="field">
          <label for="modal-empty-containers">${icon('rotate', 14)} Envases vacíos recogidos</label>
          <input id="modal-empty-containers" type="number" min="0" value="0">
        </div>
        <div class="field">
          <label for="modal-notes">Observaciones (opcional)</label>
          <textarea id="modal-notes" rows="2" placeholder="Notas sobre la entrega..."></textarea>
        </div>

        <div class="row" style="justify-content:flex-end;">
          <button class="btn-outline" id="modal-cancel">Cancelar</button>
          <button class="btn-success btn-lg" id="modal-confirm">${icon('check')} Confirmar entrega</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#modal-cancel').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  overlay.querySelector('#modal-confirm').onclick = () => {
    const prev = order.status;
    order.status = 'Entregado';

    if (needsCash) {
      const collected = document.getElementById('modal-cash-collected')?.checked;
      order.paid = collected;
    }

    order.emptyContainers = Number(document.getElementById('modal-empty-containers')?.value || 0);
    order.deliveryNotes = document.getElementById('modal-notes')?.value.trim() || '';

    if (!order.events) order.events = [];
    order.events.push({
      status: 'Entregado',
      from: prev,
      at: new Date().toISOString(),
      by: 'repartidor',
      cashCollected: order.paid,
      emptyContainers: order.emptyContainers,
    });

    setState({ orders: s.orders });
    overlay.remove();
    showToast(`Pedido ${order.number} entregado`, 'success');
    renderApp();
  };
}

/** Modal para registrar problema en la entrega */
function showFailureModal(order) {
  const s = getState();
  const reasons = [
    'Cliente ausente',
    'Dirección incorrecta',
    'Cliente solicita reprogramación',
    'No se pudo acceder al lugar',
    'Otro motivo',
  ];

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>${icon('alert', 22)} Registrar problema</h2>
      <div class="stack">
        <p>Pedido <strong>${esc(order.number)}</strong> — ${esc(order.customerName)}</p>

        <div class="field">
          <label>¿Qué sucedió?</label>
          ${reasons.map((r, i) => `
            <label style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;cursor:pointer;">
              <input type="radio" name="fail-reason" value="${esc(r)}" ${i === 0 ? 'checked' : ''}>
              <span>${esc(r)}</span>
            </label>
          `).join('')}
        </div>

        <div class="field">
          <label for="fail-notes">Detalles adicionales (opcional)</label>
          <textarea id="fail-notes" rows="2" placeholder="Descripción del problema..."></textarea>
        </div>

        <div class="row" style="justify-content:flex-end;">
          <button class="btn-outline" id="fail-modal-cancel">Cancelar</button>
          <button class="btn-danger btn-lg" id="fail-modal-confirm">${icon('alert', 16)} Registrar problema</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#fail-modal-cancel').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  overlay.querySelector('#fail-modal-confirm').onclick = () => {
    const reason = overlay.querySelector('input[name="fail-reason"]:checked')?.value || 'Sin motivo';
    const notes = document.getElementById('fail-notes')?.value.trim() || '';
    const prev = order.status;
    order.status = 'Entrega fallida';
    order.deliveryNotes = `${reason}${notes ? ' — ' + notes : ''}`;
    if (!order.events) order.events = [];
    order.events.push({
      status: 'Entrega fallida',
      from: prev,
      at: new Date().toISOString(),
      by: 'repartidor',
      reason,
    });
    setState({ orders: s.orders });
    overlay.remove();
    showToast(`Problema registrado en pedido ${order.number}`, 'info');
    renderApp();
  };
}
