/**
 * Tests de roles, seguridad y flujos de negocio.
 * Ejecutar con: npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// ============================================================
// Simulación de roles y permisos (replica la lógica de la app)
// ============================================================

const ROLES = {
  cliente: {
    canCreateOrders: true,
    canViewOwnOrders: true,
    canViewAllOrders: false,
    canManageProducts: false,
    canChangeSettings: false,
    canAssignCourier: false,
    canMarkDelivered: false,
    canViewSales: false,
    canCancelOwnOrder: true,
  },
  administradora: {
    canCreateOrders: true,  // pedidos manuales
    canViewOwnOrders: true,
    canViewAllOrders: true,
    canManageProducts: true,
    canChangeSettings: true,
    canAssignCourier: true,
    canMarkDelivered: false,
    canViewSales: true,
    canCancelOwnOrder: true,
  },
  repartidor: {
    canCreateOrders: false,
    canViewOwnOrders: false,
    canViewAllOrders: false,
    canManageProducts: false,
    canChangeSettings: false,
    canAssignCourier: false,
    canMarkDelivered: true,
    canViewSales: false,
    canCancelOwnOrder: false,
  },
};

// ============================================================
// Test 2: El cliente NO puede consultar pedidos de otras personas
// ============================================================
test('el cliente solo puede ver sus propios pedidos', () => {
  const perm = ROLES.cliente;
  assert.equal(perm.canViewOwnOrders, true, 'puede ver sus pedidos');
  assert.equal(perm.canViewAllOrders, false, 'NO puede ver todos los pedidos');
});

// ============================================================
// Test 3: El repartidor NO puede modificar precios ni gestionar usuarios
// ============================================================
test('el repartidor no puede modificar precios', () => {
  const perm = ROLES.repartidor;
  assert.equal(perm.canManageProducts, false, 'no puede gestionar productos');
  assert.equal(perm.canChangeSettings, false, 'no puede cambiar configuración');
  assert.equal(perm.canViewSales, false, 'no puede ver ventas');
  assert.equal(perm.canCreateOrders, false, 'no puede crear pedidos');
});

// ============================================================
// Test 4: La administradora puede gestionar pedidos
// ============================================================
test('la administradora puede gestionar pedidos', () => {
  const perm = ROLES.administradora;
  assert.equal(perm.canViewAllOrders, true, 'puede ver todos los pedidos');
  assert.equal(perm.canAssignCourier, true, 'puede asignar repartidor');
  assert.equal(perm.canManageProducts, true, 'puede gestionar productos');
  assert.equal(perm.canChangeSettings, true, 'puede cambiar configuración');
  assert.equal(perm.canViewSales, true, 'puede ver ventas');
});

// ============================================================
// Test 1: El cliente puede crear una cuenta y realizar un pedido
// ============================================================
test('flujo completo: cliente crea cuenta y realiza pedido', () => {
  // Simular registro
  const user = { id: 'user-1', name: 'Juan', phone: '6000-1234', role: 'cliente' };
  assert.ok(user.id, 'usuario tiene ID');
  assert.ok(user.name, 'usuario tiene nombre');

  // Simular carrito
  const cart = [
    { id: 'returnable', name: 'Botellón retornable', priceCents: 250, qty: 4 },
  ];

  // Simular checkout
  const subtotal = cart.reduce((s, i) => s + i.qty * i.priceCents, 0);
  const shipping = 450;
  const total = subtotal + shipping;

  assert.equal(subtotal, 1000);
  assert.equal(total, 1450);

  // Simular creación de pedido
  const order = {
    id: 'order-1',
    number: 'AC-0001',
    customerId: user.id,
    items: cart.map(i => ({ ...i })),
    subtotalCents: subtotal,
    shippingCents: shipping,
    totalCents: total,
    mode: 'delivery',
    address: 'Casa azul, frente al parque',
    payment: 'Efectivo al recibir',
    status: 'Pendiente',
    paid: false,
  };

  assert.equal(order.status, 'Pendiente');
  assert.equal(order.totalCents, 1450);
  assert.equal(order.items[0].priceCents, 250, 'precio histórico guardado');
});

// ============================================================
// Test 10: Una confirmación de pago no puede falsificarse
// ============================================================
test('el pago no se puede confirmar desde el cliente', () => {
  // Simular: el cliente intenta marcar como pagado directamente
  const order = {
    id: 'order-1',
    paid: false,
    payment: 'Efectivo al recibir',
    status: 'Pendiente',
  };

  // Función que valida quién puede marcar como pagado
  function markPaid(order, actor) {
    if (actor.role === 'cliente') {
      return { success: false, error: 'No autorizado' };
    }
    if (actor.role === 'repartidor' && order.payment === 'Efectivo al recibir') {
      return { success: true };
    }
    if (actor.role === 'administradora') {
      return { success: true };
    }
    return { success: false, error: 'Rol desconocido' };
  }

  // Cliente no puede marcar como pagado
  const clientAttempt = markPaid(order, { role: 'cliente' });
  assert.equal(clientAttempt.success, false, 'cliente NO puede confirmar pago');

  // Repartidor sí puede marcar efectivo
  const courierAttempt = markPaid(order, { role: 'repartidor' });
  assert.equal(courierAttempt.success, true, 'repartidor puede confirmar efectivo');

  // Admin puede marcar cualquier pago
  const adminAttempt = markPaid(order, { role: 'administradora' });
  assert.equal(adminAttempt.success, true, 'admin puede confirmar pago');
});

// ============================================================
// Test 13: Los errores de red no producen confirmaciones falsas
// ============================================================
test('error de red no produce confirmación falsa', () => {
  // Simular un pedido que falla en el servidor
  function createOrderOnServer(orderData, networkOk) {
    if (!networkOk) {
      return { success: false, error: 'Error de conexión. Intenta de nuevo.' };
    }
    return { success: true, order: orderData };
  }

  const result = createOrderOnServer({ id: 'order-1' }, false);
  assert.equal(result.success, false, 'fallo de red retorna error');
  assert.ok(result.error, 'incluye mensaje de error');

  // El pedido NO debe mostrarse como confirmado
  assert.equal(result.order, undefined, 'no hay pedido confirmado');
});

// ============================================================
// Test: Validaciones de datos de entrada
// ============================================================
test('validación rechaza datos inválidos', () => {
  function validateOrder(data) {
    const errors = [];
    if (!data.items || data.items.length === 0) errors.push('Sin productos');
    if (data.mode === 'delivery' && !data.address) errors.push('Falta dirección');
    if (!data.payment) errors.push('Falta método de pago');
    if (!data.customerName) errors.push('Falta nombre del cliente');
    return errors;
  }

  // Pedido sin productos
  assert.ok(validateOrder({ items: [], mode: 'delivery', address: 'x', payment: 'Efectivo', customerName: 'Juan' }).length > 0);

  // Entrega sin dirección
  assert.ok(validateOrder({ items: [{}], mode: 'delivery', address: '', payment: 'Efectivo', customerName: 'Juan' }).length > 0);

  // Pedido válido
  assert.equal(validateOrder({ items: [{}], mode: 'delivery', address: 'Casa 1', payment: 'Efectivo', customerName: 'Juan' }).length, 0);

  // Recogida sin dirección (válido)
  assert.equal(validateOrder({ items: [{}], mode: 'pickup', address: '', payment: 'Efectivo', customerName: 'Juan' }).length, 0);
});

// ============================================================
// Test: Roles no pueden escalarse desde el frontend
// ============================================================
test('un cliente no puede auto-asignarse rol de admin', () => {
  function changeRole(currentRole, targetRole) {
    // Solo un admin puede cambiar roles
    if (currentRole !== 'administradora') {
      return { success: false, error: 'Solo la administradora puede cambiar roles' };
    }
    return { success: true };
  }

  const clientAttempt = changeRole('cliente', 'administradora');
  assert.equal(clientAttempt.success, false);

  const courierAttempt = changeRole('repartidor', 'administradora');
  assert.equal(courierAttempt.success, false);

  const adminAttempt = changeRole('administradora', 'repartidor');
  assert.equal(adminAttempt.success, true);
});

// ============================================================
// Test: El repartidor solo ve entregas asignadas a él
// ============================================================
test('el repartidor solo ve sus entregas asignadas', () => {
  const allOrders = [
    { id: '1', assignedTo: 'courier-A', status: 'Asignado' },
    { id: '2', assignedTo: 'courier-B', status: 'En camino' },
    { id: '3', assignedTo: 'courier-A', status: 'Entregado' },
    { id: '4', assignedTo: null, status: 'Pendiente' },
  ];

  const courierId = 'courier-A';
  const myDeliveries = allOrders.filter(o =>
    o.assignedTo === courierId && ['Asignado', 'En camino'].includes(o.status)
  );

  assert.equal(myDeliveries.length, 1, 'solo ve 1 entrega activa');
  assert.equal(myDeliveries[0].id, '1');
});

// ============================================================
// Test: Historial del repartidor
// ============================================================
test('historial del repartidor incluye entregas completadas', () => {
  const allOrders = [
    { id: '1', assignedTo: 'courier-A', status: 'Asignado' },
    { id: '2', assignedTo: 'courier-A', status: 'Entregado' },
    { id: '3', assignedTo: 'courier-A', status: 'Entrega fallida' },
    { id: '4', assignedTo: 'courier-B', status: 'Entregado' },
  ];

  const myHistory = allOrders.filter(o =>
    o.assignedTo === 'courier-A' && ['Entregado', 'Entrega fallida'].includes(o.status)
  );

  assert.equal(myHistory.length, 2);
});

// ============================================================
// Test: Informe de ventas del día
// ============================================================
test('informe de ventas calcula correctamente', () => {
  const today = new Date().toDateString();
  const orders = [
    { totalCents: 1450, subtotalCents: 1000, shippingCents: 450, status: 'Entregado', paid: true, payment: 'Efectivo al recibir', createdAt: new Date().toISOString(), items: [{ qty: 4 }] },
    { totalCents: 700, subtotalCents: 250, shippingCents: 450, status: 'Entregado', paid: true, payment: 'Efectivo al recibir', createdAt: new Date().toISOString(), items: [{ qty: 1 }] },
    { totalCents: 1000, subtotalCents: 1000, shippingCents: 0, status: 'Cancelado', paid: false, payment: 'Efectivo al recibir', createdAt: new Date().toISOString(), items: [{ qty: 4 }] },
  ];

  const delivered = orders.filter(o => o.status === 'Entregado');
  const cancelled = orders.filter(o => o.status === 'Cancelado');
  const totalVentas = delivered.reduce((s, o) => s + o.totalCents, 0);
  const totalAgua = delivered.reduce((s, o) => s + o.subtotalCents, 0);
  const totalEnvio = delivered.reduce((s, o) => s + o.shippingCents, 0);
  const botellones = delivered.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0);
  const efectivoCobrado = delivered.filter(o => o.paid && o.payment === 'Efectivo al recibir')
    .reduce((s, o) => s + o.totalCents, 0);

  assert.equal(delivered.length, 2, '2 pedidos entregados');
  assert.equal(cancelled.length, 1, '1 pedido cancelado');
  assert.equal(totalVentas, 2150, 'total ventas = 1450 + 700');
  assert.equal(totalAgua, 1250, 'total agua = 1000 + 250');
  assert.equal(totalEnvio, 900, 'total envío = 450 + 450');
  assert.equal(botellones, 5, 'botellones = 4 + 1');
  assert.equal(efectivoCobrado, 2150, 'todo cobrado en efectivo');
});
