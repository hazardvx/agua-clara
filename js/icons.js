/**
 * icons.js — Set de iconos SVG inline (estilo SF Symbols).
 * Trazo 1.8, esquinas redondeadas, currentColor. Sin emojis.
 *
 * Uso: icon('nombre', tamañoPx) → string SVG para interpolar en templates.
 */

const P = {
  droplet: '<path d="M12 2.7 6.3 8.4a8 8 0 1 0 11.4 0Z"/>',
  home: '<path d="M3 10.2 12 3l9 7.2V20a1.5 1.5 0 0 1-1.5 1.5H15V14H9v7.5H4.5A1.5 1.5 0 0 1 3 20Z"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18.5" cy="20" r="1.4"/><path d="M2.5 3.5h2.6l2.5 11.1a1.6 1.6 0 0 0 1.6 1.3h8.4a1.6 1.6 0 0 0 1.6-1.3l1.9-7.6H6.4"/>',
  clipboard: '<path d="M9 4.5H7A1.5 1.5 0 0 0 5.5 6v13A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V6A1.5 1.5 0 0 0 17 4.5h-2"/><rect x="9" y="2.8" width="6" height="3.4" rx="1.2"/><path d="M8.5 11h7M8.5 15h5"/>',
  user: '<circle cx="12" cy="7.5" r="3.8"/><path d="M4.5 20.8c.7-3.7 3.9-5.8 7.5-5.8s6.8 2.1 7.5 5.8"/>',
  truck: '<path d="M2.5 6.5h11.5v10H2.5z"/><path d="M14 10h3.8l3.2 3.2v3.3H14z"/><circle cx="6.8" cy="18.6" r="1.9"/><circle cx="17.4" cy="18.6" r="1.9"/>',
  box: '<path d="M12 2.8 3.5 6.6v10.8L12 21.2l8.5-3.8V6.6Z"/><path d="M3.5 6.6 12 10.4l8.5-3.8M12 10.4v10.8"/>',
  wallet: '<rect x="2.8" y="5.5" width="18.4" height="13" rx="2.4"/><path d="M2.8 9.5h18.4M16.5 14.5h1.8"/>',
  settings: '<circle cx="12" cy="12" r="3.1"/><path d="M19.2 14.6a1.5 1.5 0 0 0 .3 1.7l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-2.6 1.1v.3a1.8 1.8 0 1 1-3.6 0v-.2a1.5 1.5 0 0 0-2.7-1.1l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0-1.1-2.6h-.3a1.8 1.8 0 1 1 0-3.6h.2a1.5 1.5 0 0 0 1.1-2.7l-.1-.1A1.8 1.8 0 1 1 7.7 4.9l.1.1a1.5 1.5 0 0 0 2.6-1.1v-.3a1.8 1.8 0 1 1 3.6 0v.2a1.5 1.5 0 0 0 2.6 1.1l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0 1.1 2.6h.3a1.8 1.8 0 1 1 0 3.6h-.2a1.5 1.5 0 0 0-1.4.9Z"/>',
  pin: '<path d="M20 10.4c0 6.2-8 12.1-8 12.1s-8-5.9-8-12.1a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10.2" r="2.9"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6.8V12l3.6 2.1"/>',
  check: '<path d="M20 6.5 9.4 17.1 4 11.7"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16.2v-4.6M12 8.2h.01"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  minus: '<path d="M5.5 12h13"/>',
  arrowRight: '<path d="M4.5 12h14M13 5.8l6.2 6.2-6.2 6.2"/>',
  arrowLeft: '<path d="M19.5 12h-14M11 5.8 4.8 12 11 18.2"/>',
  chevronRight: '<path d="M9.5 5.8 15.7 12l-6.2 6.2"/>',
  phone: '<path d="M21.5 16.9v2.7a1.9 1.9 0 0 1-2.1 1.9 18.6 18.6 0 0 1-8.1-2.9 18.3 18.3 0 0 1-5.6-5.6A18.6 18.6 0 0 1 2.7 4.8 1.9 1.9 0 0 1 4.6 2.7h2.7a1.9 1.9 0 0 1 1.9 1.6c.1.9.4 1.8.7 2.7a1.9 1.9 0 0 1-.4 2L8.3 10a15 15 0 0 0 5.6 5.6l1-1.2a1.9 1.9 0 0 1 2-.4c.9.3 1.8.6 2.7.7a1.9 1.9 0 0 1 1.7 2Z"/>',
  refresh: '<path d="M21 4.5v5.2h-5.2M3 19.5v-5.2h5.2"/><path d="M19.4 9.7A8.3 8.3 0 0 0 5.3 7.4l-2.3 2.1M4.6 14.3a8.3 8.3 0 0 0 14.1 2.3l2.3-2.1"/>',
  alert: '<path d="M10.3 3.9 2.4 17.7A1.9 1.9 0 0 0 4 20.6h16a1.9 1.9 0 0 0 1.6-2.9L13.7 3.9a1.9 1.9 0 0 0-3.4 0Z"/><path d="M12 9.4v4M12 16.6h.01"/>',
  rotate: '<path d="M2.8 4.5v5.2H8"/><path d="M5.2 15a8.5 8.5 0 1 0 1.6-8.8L2.8 9.7"/>',
  message: '<path d="M20.8 11.4a8.1 8.1 0 0 1-8.6 8.1 8.7 8.7 0 0 1-3.5-.8L3.5 20.3l1.6-5a8.1 8.1 0 0 1-.9-3.7 8.1 8.1 0 0 1 8.2-8.1 8.1 8.1 0 0 1 8.4 7.9Z"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2.4"/><path d="M2.5 9.7h19M6.5 15h3"/>',
  chart: '<path d="M6.5 20.5v-6M12 20.5V4.5M17.5 20.5v-9"/>',
  bag: '<path d="M6 7.5h12l1.3 13a1.5 1.5 0 0 1-1.5 1.6H6.2a1.5 1.5 0 0 1-1.5-1.6Z"/><path d="M8.5 9.5V6a3.5 3.5 0 0 1 7 0v3.5"/>',
  car: '<path d="M4.8 11.5 6.3 7A2 2 0 0 1 8.2 5.6h7.6A2 2 0 0 1 17.7 7l1.5 4.5"/><rect x="3" y="11.5" width="18" height="6" rx="2"/><circle cx="7.3" cy="18.8" r="1.7"/><circle cx="16.7" cy="18.8" r="1.7"/>',
  logout: '<path d="M9.5 21H5.5A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3h4"/><path d="m15.5 16.5 4.5-4.5-4.5-4.5M20 12H9"/>',
  inbox: '<path d="M21.5 12.5h-5.3l-1.7 2.7H9.5l-1.7-2.7H2.5"/><path d="M5.7 4.9 2.5 12.5v5.4a1.7 1.7 0 0 0 1.7 1.7h15.6a1.7 1.7 0 0 0 1.7-1.7v-5.4l-3.2-7.6a1.7 1.7 0 0 0-1.6-1.1H7.3a1.7 1.7 0 0 0-1.6 1.1Z"/>',
  store: '<path d="M4 9.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19V9.5"/><path d="M3 9.5 4.8 4h14.4L21 9.5a2.6 2.6 0 0 1-4.5 1.8 2.6 2.6 0 0 1-4.5 0 2.6 2.6 0 0 1-4.5 0A2.6 2.6 0 0 1 3 9.5Z"/>',
  navigation: '<path d="M20.8 3.2 3.6 10.4a.6.6 0 0 0 .1 1.1l7 2.2 2.2 7a.6.6 0 0 0 1.1.1Z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M8 2.8v4.4M16 2.8v4.4M3.5 10.2h17"/>',
  pause: '<path d="M9 5.5v13M15 5.5v13"/>',
  play: '<path d="M7.5 5.2 18.5 12l-11 6.8Z"/>',
  history: '<path d="M3.5 4.5v5h5"/><path d="M5.5 14.5a8.5 8.5 0 1 0 1.4-8.6L3.5 9.5"/><path d="M12 8v4.4l3.2 1.9"/>',
  save: '<path d="M19.5 21H4.5A1.5 1.5 0 0 1 3 19.5v-15A1.5 1.5 0 0 1 4.5 3H16l5 5v11.5A1.5 1.5 0 0 1 19.5 21Z"/><path d="M16 21v-6H8v6M8 3v5h7"/>',
  list: '<path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12"/><path d="M4 6.5h.01M4 12h.01M4 17.5h.01"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.4 9.2a2.7 2.7 0 0 1 5.3.8c0 1.8-2.7 2.5-2.7 2.5M12 16.5h.01"/>',
};

/**
 * Devuelve un SVG inline.
 * @param {string} name clave del icono
 * @param {number} size lado del cuadro en px (default 20)
 * @param {string} extra clase adicional
 */
export function icon(name, size = 20, extra = '') {
  const path = P[name] || P.info;
  return `<svg class="ico${extra ? ' ' + extra : ''}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
}

/** Set completo (para pruebas/inspección) */
export const iconNames = Object.keys(P);
