/**
 * store.js — Estado central de la aplicación Agua Clara.
 * 
 * En modo demo (sin Supabase), los datos se persisten en localStorage.
 * Cuando se configure Supabase, este módulo será la capa de abstracción
 * para todas las operaciones de datos.
 */

const STORAGE_KEY = 'agua-clara-v3';

const DEFAULT_STATE = {
  role: 'cliente',
  view: 'login',
  user: { id: '', name: '', phone: '', email: '' },
  isLoggedIn: false,
  authReturnTo: '',
  catalogVersion: 3,
  settings: {
    businessName: 'Agua Clara',
    shippingCents: 450,
    storePickup: 'Calle principal, frente al parque · 8:00 a.m. a 5:00 p.m.',
    whatsapp: '50760000000',
    pickupEnabled: true,
    expensesCents: 0,
  },
  products: [
    { id: 'aquaviva', name: 'Agua Aquaviva · garrafón 5 galones', type: 'Retornable', priceCents: 490, available: true, image: 'img/aquaviva.jpg', description: 'Marca panameña. Garrafón de 5 galones: devuelve el envase vacío al recoger uno nuevo.' },
    { id: 'cristalina', name: 'Agua Cristalina · garrafón 5 galones', type: 'Retornable', priceCents: 550, available: true, image: 'img/cristalina.jpg', description: 'Agua purificada. Garrafón de 5 galones: devuelve el envase vacío al recoger uno nuevo.' },
    { id: 'purissima', name: 'Agua Purísima · garrafón 5 galones', type: 'Retornable', priceCents: 495, available: true, image: 'img/purissima.jpg', description: 'Agua purificada de marca. Garrafón de 5 galones: devuelve el envase vacío al recoger uno nuevo.' },
  ],
  addresses: [],
  checkoutLocation: null,
  cart: [],
  orders: [],
  vehicles: [{ id: 'van-1', name: 'Camión principal', plate: 'Pendiente', maintenance: '', active: true }],
};

let state = null;
const listeners = new Set();

/** IDs del catálogo anterior (2 productos genéricos) que deben reemplazarse */
const LEGACY_PRODUCT_IDS = ['returnable', 'new'];

/** Versión del catálogo: al subir, se reemplazan los productos guardados */
const CATALOG_VERSION = 3;

/**
 * Migración de catálogo: reemplaza los productos genéricos antiguos o los de
 * una versión anterior por el catálogo actual. Los pedidos existentes conservan
 * sus items (copia de precio al momento del pedido), por lo que no se alteran.
 * El carrito solo se vacía si referenciaba IDs que ya no existen.
 * v2 → v3: solo añade las fotos de producto, sin tocar precios editados.
 */
function migrateCatalog(s) {
  const version = s.catalogVersion || 1;
  const hasLegacy = (s.products || []).some(p => LEGACY_PRODUCT_IDS.includes(p.id));
  if (hasLegacy || version < 2) {
    s.products = DEFAULT_STATE.products.map(p => ({ ...p }));
    if (hasLegacy) s.cart = (s.cart || []).filter(i => !LEGACY_PRODUCT_IDS.includes(i.id));
    s.catalogVersion = CATALOG_VERSION;
    return true;
  }
  if (version < CATALOG_VERSION) {
    s.products = (s.products || []).map(p => {
      const base = DEFAULT_STATE.products.find(d => d.id === p.id);
      return base && !p.image ? { ...p, image: base.image } : p;
    });
    s.catalogVersion = CATALOG_VERSION;
    return true;
  }
  return false;
}

/** Inicializa el estado desde localStorage o usa valores por defecto */
export function initStore() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    state = saved ? { ...DEFAULT_STATE, ...JSON.parse(saved) } : { ...DEFAULT_STATE };
  } catch {
    state = { ...DEFAULT_STATE };
  }
  if (migrateCatalog(state)) persist();
  return state;
}

/** Devuelve una copia del estado actual */
export function getState() {
  if (!state) initStore();
  return state;
}

/** Actualiza parte del estado y notifica a los listeners */
export function setState(partial) {
  Object.assign(state, partial);
  persist();
  notify();
}

/** Actualiza una propiedad anidada del estado */
export function updateNested(key, value) {
  state[key] = typeof value === 'function' ? value(state[key]) : value;
  persist();
  notify();
}

/** Persiste el estado a localStorage */
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* localStorage lleno o no disponible */ }
}

/** Suscribe una función a cambios de estado */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Notifica a todos los suscriptores */
function notify() {
  listeners.forEach(fn => {
    try { fn(state); } catch (e) { console.error('Store listener error:', e); }
  });
}

// --- Helpers de negocio ---

/** Formatea centavos a B/. con 2 decimales */
export function money(cents) {
  return `B/. ${(cents / 100).toFixed(2)}`;
}

/** Genera un UUID v4 */
export function uid() {
  return crypto.randomUUID();
}

/** Escapa HTML para prevenir XSS */
export function esc(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str ?? '').replace(/[&<>"']/g, c => map[c]);
}

/** Calcula el total de un pedido (en centavos) */
export function calcOrderTotal(items, mode, shippingCents) {
  const subtotal = items.reduce((s, i) => s + i.qty * i.priceCents, 0);
  const shipping = mode === 'delivery' ? shippingCents : 0;
  return { subtotal, shipping, total: subtotal + shipping };
}

/** Genera número de pedido secuencial */
export function nextOrderNumber() {
  const count = state.orders.length + 1;
  return `AC-${String(count).padStart(4, '0')}`;
}

/**
 * Pedidos visibles para un cliente autenticado.
 * Solo los pedidos que pertenecen a su cuenta (customerId coincide);
 * los pedidos sin dueño (manuales/legado) no se muestran a clientes.
 */
export function customerOrders(orders, userId) {
  if (!userId) return [];
  return orders.filter(o => o.customerId === userId);
}

/**
 * Acciones de estado disponibles para un pedido desde el panel de administración.
 * Centraliza el flujo para que sea testeable y consistente.
 *
 * @param {{status:string, mode:string}} order
 * @returns {Array<{action:'status'|'assign', status:string, label:string, variant:string}>}
 */
export function orderActions(order) {
  const actions = [];
  const add = (action, status, label, variant) => actions.push({ action, status, label, variant });

  if (order.status === 'Pendiente') {
    add('status', 'Aceptado', 'Aceptar', 'btn-primary');
  }
  if (order.status === 'Aceptado') {
    add('status', 'En preparación', 'Preparar', 'btn-secondary');
  }
  if (['Aceptado', 'En preparación'].includes(order.status)) {
    add('assign', 'Asignado', 'Asignar repartidor', 'btn-primary');
  }
  // Recogida en el local: no pasa por "En camino", va directo a lista para retirar
  if (order.mode === 'pickup' && ['En preparación', 'Asignado'].includes(order.status)) {
    add('status', 'Listo para recoger', 'Listo para recoger', 'btn-primary');
  }
  // Recogida completada: el cliente retiró el pedido en el local
  if (order.status === 'Listo para recoger') {
    add('status', 'Entregado', 'Cliente retiró', 'btn-success');
  }
  // Cancelación: siempre disponible salvo en estados finales
  if (!['Entregado', 'Cancelado'].includes(order.status)) {
    add('status', 'Cancelado', 'Cancelar', 'btn-danger');
  }
  return actions;
}

/** Devuelve la clase CSS correspondiente al estado del pedido */
export function statusBadgeClass(status) {
  const map = {
    'Pendiente': 'badge-amber badge-dot',
    'Aceptado': 'badge-blue badge-dot',
    'En preparación': 'badge-cyan badge-dot',
    'Asignado': 'badge-blue badge-dot',
    'En camino': 'badge-blue badge-dot',
    'Listo para recoger': 'badge-blue badge-dot',
    'Entregado': 'badge-green badge-dot',
    'Entrega fallida': 'badge-red badge-dot',
    'Cancelado': 'badge-red badge-dot',
  };
  return map[status] || 'badge-blue';
}

/** Devuelve la clase CSS para el borde lateral del pedido */
export function orderCardClass(status) {
  if (status === 'Entregado') return 'status-entregado';
  if (status === 'Cancelado') return 'status-cancelado';
  if (status === 'Entrega fallida') return 'status-fallida';
  if (status === 'Pendiente') return 'status-pendiente';
  return '';
}

/** Formatea fecha para Panamá (America/Panama, UTC-5) */
export function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('es-PA', {
      timeZone: 'America/Panama',
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** Limpia el carrito */
export function clearCart() {
  state.cart = [];
  persist();
  notify();
}

/** Agrega un producto al carrito */
export function addToCart(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product || !product.available) return;
  const existing = state.cart.find(i => i.id === productId);
  if (existing) {
    existing.qty++;
  } else {
    state.cart.push({ id: product.id, name: product.name, priceCents: product.priceCents, type: product.type, qty: 1 });
  }
  persist();
  notify();
}

/** Actualiza la cantidad de un item en el carrito */
export function updateCartQty(productId, delta) {
  const item = state.cart.find(i => i.id === productId);
  if (!item) return;
  item.qty += delta;
  if (item.qty < 1) {
    state.cart = state.cart.filter(i => i.id !== productId);
  }
  persist();
  notify();
}

/** Elimina un item del carrito */
export function removeFromCart(productId) {
  state.cart = state.cart.filter(i => i.id !== productId);
  persist();
  notify();
}

/** Total de items en el carrito */
export function cartCount() {
  return state.cart.reduce((a, i) => a + i.qty, 0);
}

/** Resetea el estado a valores por defecto (para demo) */
export function resetState() {
  state = { ...DEFAULT_STATE };
  persist();
  notify();
}
