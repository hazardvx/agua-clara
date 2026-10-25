/**
 * Tests de flujos que IMPORTAN el código real de js/store.js (no una copia).
 * Si store.js se rompe, estos tests fallan.
 * Ejecutar con: npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calcOrderTotal,
  money,
  esc,
  orderActions,
  statusBadgeClass,
} from '../js/store.js';

// --- Utilidad: aplica una acción del panel de admin sobre un pedido ---
function applyAction(order, action) {
  if (action.action === 'assign') {
    order.status = action.status;
    order.assignedTo = 'repartidor';
  } else {
    order.status = action.status;
  }
  return order;
}

function actionByStatus(order, status) {
  return orderActions(order).find(a => a.action === 'status' && a.status === status);
}

function makeOrder(mode) {
  return {
    id: 'order-test',
    number: 'AC-0001',
    mode,
    status: 'Pendiente',
    paid: false,
    items: [{ id: 'returnable', name: 'Botellón retornable 5 galones', priceCents: 250, qty: 4 }],
    subtotalCents: 1000,
    shippingCents: mode === 'delivery' ? 450 : 0,
    totalCents: mode === 'delivery' ? 1450 : 1000,
  };
}

// ============================================================
// Regla comercial: envío B/.4.50 fijo por pedido, 0 en recogida
// ============================================================
test('regla de envío real del store: B/.4.50 fijo por pedido', () => {
  const uno = calcOrderTotal([{ priceCents: 250, qty: 1 }], 'delivery', 450);
  const diez = calcOrderTotal([{ priceCents: 250, qty: 10 }], 'delivery', 450);

  assert.equal(uno.shipping, 450);
  assert.equal(diez.shipping, 450, 'el envío no se multiplica por botellones');
  assert.equal(uno.total, 700);
  assert.equal(diez.total, 2950);
});

test('regla de envío real del store: recogida = B/.0.00', () => {
  const r = calcOrderTotal([{ priceCents: 250, qty: 4 }], 'pickup', 450);
  assert.equal(r.shipping, 0);
  assert.equal(r.total, 1000);
  assert.equal(money(r.total), 'B/. 10.00');
});

test('formato B/. real del store', () => {
  assert.equal(money(450), 'B/. 4.50');
  assert.equal(money(1450), 'B/. 14.50');
  assert.equal(money(0), 'B/. 0.00');
});

test('escape HTML real del store previene XSS', () => {
  assert.equal(esc('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(esc(`"'/`), '&quot;&#039;/');
  assert.equal(esc(null), '');
});

// ============================================================
// Flujo de entrega a domicilio
// ============================================================
test('flujo de entrega: hasta asignación, luego lo toma el repartidor', () => {
  const order = makeOrder('delivery');

  applyAction(order, actionByStatus(order, 'Aceptado'));
  assert.equal(order.status, 'Aceptado');

  applyAction(order, actionByStatus(order, 'En preparación'));
  assert.equal(order.status, 'En preparación');

  const assign = orderActions(order).find(a => a.action === 'assign');
  assert.ok(assign, 'la admin puede asignar el repartidor');
  applyAction(order, assign);
  assert.equal(order.status, 'Asignado');
  assert.equal(order.assignedTo, 'repartidor');

  // Desde aquí el repartidor marca "En camino" y "Entregado"
  assert.equal(orderActions(order).find(a => a.status === 'En camino'), undefined,
    'el botón "En camino" vive en la tarjeta del repartidor, no en la de admin');
  order.status = 'En camino';
  order.status = 'Entregado';
  assert.equal(order.status, 'Entregado');
  assert.equal(orderActions(order).length, 0, 'un pedido entregado no admite más acciones');
});

test('la entrega a domicilio NUNCA ofrece "Listo para recoger"', () => {
  for (const status of ['Pendiente', 'Aceptado', 'En preparación', 'Asignado', 'En camino']) {
    const order = { ...makeOrder('delivery'), status };
    const labels = orderActions(order).map(a => a.status);
    assert.ok(!labels.includes('Listo para recoger'),
      `estado ${status}: una entrega no debe pasar por "Listo para recoger"`);
  }
});

// ============================================================
// Flujo de recogida en el local (bug corregido: no se quedaba bloqueado)
// ============================================================
test('flujo de recogida completa hasta Entregado sin pasar por En camino', () => {
  const order = makeOrder('pickup');

  applyAction(order, actionByStatus(order, 'Aceptado'));
  applyAction(order, actionByStatus(order, 'En preparación'));

  const ready = actionByStatus(order, 'Listo para recoger');
  assert.ok(ready, 'desde "En preparación" la admin puede marcar "Listo para recoger"');
  applyAction(order, ready);
  assert.equal(order.status, 'Listo para recoger');

  const pickUp = actionByStatus(order, 'Entregado');
  assert.ok(pickUp, 'desde "Listo para recoger" la admin puede darlo por retirado');
  assert.equal(pickUp.label, 'Cliente retiró');
  applyAction(order, pickUp);
  assert.equal(order.status, 'Entregado');
  assert.equal(orderActions(order).length, 0, 'flujo de recogida terminado');
});

test('la recogida puede marcarse lista también tras asignar al repartidor', () => {
  const order = makeOrder('pickup');
  applyAction(order, actionByStatus(order, 'Aceptado'));
  applyAction(order, actionByStatus(order, 'En preparación'));
  applyAction(order, orderActions(order).find(a => a.action === 'assign'));
  assert.equal(order.status, 'Asignado');

  const ready = actionByStatus(order, 'Listo para recoger');
  assert.ok(ready, 'desde "Asignado" también se puede marcar "Listo para recoger"');
  applyAction(order, ready);
  assert.equal(order.status, 'Listo para recoger');
});

// ============================================================
// Cancelación
// ============================================================
test('un pedido activo siempre puede cancelarse; uno final no', () => {
  for (const status of ['Pendiente', 'Aceptado', 'En preparación', 'Asignado', 'Listo para recoger']) {
    const order = { ...makeOrder('delivery'), status };
    const cancel = orderActions(order).find(a => a.status === 'Cancelado');
    assert.ok(cancel, `estado ${status} debe poder cancelarse`);
    assert.equal(cancel.variant, 'btn-danger');
  }

  for (const status of ['Entregado', 'Cancelado']) {
    const order = { ...makeOrder('delivery'), status };
    assert.equal(orderActions(order).length, 0, `estado final ${status} sin acciones`);
  }
});

// ============================================================
// Badge de estado (usado por las tres vistas)
// ============================================================
test('todos los estados del flujo tienen clase de badge', () => {
  const estados = [
    'Pendiente', 'Aceptado', 'En preparación', 'Asignado', 'En camino',
    'Listo para recoger', 'Entregado', 'Entrega fallida', 'Cancelado',
  ];
  for (const estado of estados) {
    assert.ok(statusBadgeClass(estado), `${estado} debe tener badge`);
  }
});
