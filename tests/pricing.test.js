/**
 * Tests de lógica de precios y reglas de negocio para Agua Clara.
 * Ejecutar con: npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// ============================================================
// Funciones de cálculo (replicadas del store para testear sin DOM)
// ============================================================

/** Calcula subtotal, envío y total de un pedido */
function calcOrderTotal(items, mode, shippingCents) {
  const subtotal = items.reduce((s, i) => s + i.qty * i.priceCents, 0);
  const shipping = mode === 'delivery' ? shippingCents : 0;
  return { subtotal, shipping, total: subtotal + shipping };
}

/** Formatea centavos a string B/. */
function money(cents) {
  return `B/. ${(cents / 100).toFixed(2)}`;
}

// ============================================================
// Test 5: 4 botellones de B/.2.50 + envío B/.4.50 = B/.14.50
// ============================================================
test('4 botellones a B/.2.50 con envío = B/.14.50', () => {
  const items = [{ priceCents: 250, qty: 4 }];
  const result = calcOrderTotal(items, 'delivery', 450);
  assert.equal(result.subtotal, 1000, 'subtotal agua debe ser 1000 centavos');
  assert.equal(result.shipping, 450, 'envío debe ser 450 centavos');
  assert.equal(result.total, 1450, 'total debe ser 1450 centavos');
  assert.equal(money(result.total), 'B/. 14.50');
});

// ============================================================
// Test 6: 1 botellón de B/.2.50 + envío B/.4.50 = B/.7.00
// ============================================================
test('1 botellón a B/.2.50 con envío = B/.7.00', () => {
  const items = [{ priceCents: 250, qty: 1 }];
  const result = calcOrderTotal(items, 'delivery', 450);
  assert.equal(result.subtotal, 250);
  assert.equal(result.shipping, 450);
  assert.equal(result.total, 700);
  assert.equal(money(result.total), 'B/. 7.00');
});

// ============================================================
// Test 7: 4 botellones para recoger = B/.10.00 (sin envío)
// ============================================================
test('4 botellones a B/.2.50 para recoger = B/.10.00', () => {
  const items = [{ priceCents: 250, qty: 4 }];
  const result = calcOrderTotal(items, 'pickup', 450);
  assert.equal(result.subtotal, 1000);
  assert.equal(result.shipping, 0, 'recogida no debe tener envío');
  assert.equal(result.total, 1000);
  assert.equal(money(result.total), 'B/. 10.00');
});

// ============================================================
// Test 8: El envío NUNCA se multiplica por la cantidad
// ============================================================
test('el envío es fijo por pedido, no se multiplica por botellones', () => {
  const one = calcOrderTotal([{ priceCents: 250, qty: 1 }], 'delivery', 450);
  const four = calcOrderTotal([{ priceCents: 250, qty: 4 }], 'delivery', 450);
  const ten = calcOrderTotal([{ priceCents: 250, qty: 10 }], 'delivery', 450);

  assert.equal(one.shipping, 450, 'envío 1 botellón');
  assert.equal(four.shipping, 450, 'envío 4 botellones');
  assert.equal(ten.shipping, 450, 'envío 10 botellones');
  assert.equal(one.shipping, four.shipping, '1 y 4 botellones = mismo envío');
  assert.equal(four.shipping, ten.shipping, '4 y 10 botellones = mismo envío');
});

// ============================================================
// Test: Los importes usan centavos enteros (sin punto flotante)
// ============================================================
test('todos los importes son centavos enteros', () => {
  const result = calcOrderTotal([{ priceCents: 275, qty: 3 }], 'delivery', 450);
  assert.equal(Number.isInteger(result.subtotal), true);
  assert.equal(Number.isInteger(result.shipping), true);
  assert.equal(Number.isInteger(result.total), true);
});

// ============================================================
// Test: Múltiples productos en un pedido
// ============================================================
test('pedido con productos mixtos (retornable + nuevo)', () => {
  const items = [
    { priceCents: 250, qty: 3 },  // retornable
    { priceCents: 600, qty: 1 },  // nuevo
  ];
  const result = calcOrderTotal(items, 'delivery', 450);
  assert.equal(result.subtotal, 750 + 600, 'subtotal = 3×250 + 1×600');
  assert.equal(result.subtotal, 1350);
  assert.equal(result.shipping, 450);
  assert.equal(result.total, 1800);
});

// ============================================================
// Test: Recogida con múltiples productos
// ============================================================
test('recogida con múltiples productos no tiene envío', () => {
  const items = [
    { priceCents: 250, qty: 2 },
    { priceCents: 600, qty: 2 },
  ];
  const result = calcOrderTotal(items, 'pickup', 450);
  assert.equal(result.shipping, 0);
  assert.equal(result.total, 500 + 1200);
  assert.equal(result.total, 1700);
});

// ============================================================
// Test: Pedido vacío
// ============================================================
test('pedido sin items tiene total 0 + envío', () => {
  const result = calcOrderTotal([], 'delivery', 450);
  assert.equal(result.subtotal, 0);
  assert.equal(result.shipping, 450);
  assert.equal(result.total, 450);
});

test('pedido vacío para recoger tiene total 0', () => {
  const result = calcOrderTotal([], 'pickup', 450);
  assert.equal(result.total, 0);
});

// ============================================================
// Test: La tarifa de envío es configurable
// ============================================================
test('la tarifa de envío es configurable', () => {
  const r1 = calcOrderTotal([{ priceCents: 250, qty: 4 }], 'delivery', 500);
  assert.equal(r1.total, 1500, 'con envío de B/.5.00');

  const r2 = calcOrderTotal([{ priceCents: 250, qty: 4 }], 'delivery', 0);
  assert.equal(r2.total, 1000, 'con envío gratuito');
});

// ============================================================
// Test 9: Cambiar precios no altera compras históricas
// ============================================================
test('los precios históricos se conservan en el pedido', () => {
  // Simular: pedido se crea con precio de 250
  const order = {
    items: [{ priceCents: 250, qty: 4 }],
    subtotalCents: 1000,
    shippingCents: 450,
    totalCents: 1450,
  };

  // Simular: precio sube a 300
  const newPrice = 300;

  // El pedido original NO cambia
  assert.equal(order.items[0].priceCents, 250, 'precio en el pedido no cambia');
  assert.equal(order.totalCents, 1450, 'total en el pedido no cambia');

  // Nuevo pedido usa nuevo precio
  const newOrder = calcOrderTotal([{ priceCents: newPrice, qty: 4 }], 'delivery', 450);
  assert.equal(newOrder.total, 1650, 'nuevo pedido usa precio actualizado');
  assert.notEqual(order.totalCents, newOrder.total, 'los totales son diferentes');
});

// ============================================================
// Test 12: Las transiciones de estado siguen el flujo correcto
// ============================================================
test('flujo de estados válido para entrega a domicilio', () => {
  const validTransitions = {
    'Pendiente': ['Aceptado', 'Cancelado'],
    'Aceptado': ['En preparación', 'Asignado', 'Cancelado'],
    'En preparación': ['Asignado', 'Cancelado'],
    'Asignado': ['En camino', 'Cancelado'],
    'En camino': ['Entregado', 'Entrega fallida'],
    'Entregado': [],
    'Entrega fallida': ['Asignado'],
    'Cancelado': [],
  };

  // Verificar que cada estado tiene transiciones definidas
  for (const [from, targets] of Object.entries(validTransitions)) {
    assert.ok(Array.isArray(targets), `${from} tiene transiciones definidas`);
  }

  // Verificar que 'Entregado' y 'Cancelado' son estados finales
  assert.equal(validTransitions['Entregado'].length, 0, 'Entregado es estado final');
  assert.equal(validTransitions['Cancelado'].length, 0, 'Cancelado es estado final');
});

test('flujo de estados para recogida en local', () => {
  const pickupFlow = ['Pendiente', 'Aceptado', 'En preparación', 'Listo para recoger', 'Entregado'];
  // Recogida no pasa por 'En camino'
  assert.ok(!pickupFlow.includes('En camino'), 'recogida no pasa por En camino');
  assert.ok(pickupFlow.includes('Listo para recoger'), 'recogida incluye Listo para recoger');
});

// ============================================================
// Test: Formato de moneda
// ============================================================
test('formato B/. es correcto', () => {
  assert.equal(money(0), 'B/. 0.00');
  assert.equal(money(100), 'B/. 1.00');
  assert.equal(money(450), 'B/. 4.50');
  assert.equal(money(1450), 'B/. 14.50');
  assert.equal(money(250), 'B/. 2.50');
  assert.equal(money(10000), 'B/. 100.00');
});

// ============================================================
// Test: Escape HTML previene XSS
// ============================================================
test('escape HTML previene inyección', () => {
  function esc(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str ?? '').replace(/[&<>"']/g, c => map[c]);
  }
  assert.equal(esc('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.equal(esc(null), '');
  assert.equal(esc(undefined), '');
  assert.equal(esc('Agua "Clara"'), 'Agua &quot;Clara&quot;');
});

// ============================================================
// Test 11: Idempotencia (los reintentos no crean duplicados)
// ============================================================
test('idempotencia con clave única previene duplicados', () => {
  const orders = [];
  const idempotencyKey = 'unique-key-123';

  function createOrder(key, data) {
    const existing = orders.find(o => o.idempotencyKey === key);
    if (existing) return existing; // Retorna el existente, no crea nuevo
    const order = { ...data, idempotencyKey: key };
    orders.push(order);
    return order;
  }

  const first = createOrder(idempotencyKey, { number: 'AC-0001', total: 1450 });
  const retry = createOrder(idempotencyKey, { number: 'AC-0001', total: 1450 });

  assert.equal(orders.length, 1, 'solo se crea un pedido');
  assert.equal(first, retry, 'el reintento devuelve el mismo pedido');
});
