// Simulated order lifecycle. A real app gets these updates from the restaurant
// and rider apps over websockets/push; here they advance on a timer that is
// computed from placedAt, so refreshing the page never breaks tracking.
export const STAGES = [
  { key: 'placed', label: 'Order placed', at: 0 },
  { key: 'accepted', label: 'Restaurant accepted your order', at: 10 },
  { key: 'preparing', label: 'Your food is being prepared', at: 25 },
  { key: 'picked', label: 'Rider picked up your order', at: 70 },
  { key: 'delivered', label: 'Delivered', at: 160 },
];
export const TRAVEL_START = STAGES[3].at;
export const TRAVEL_END = STAGES[4].at;
export const CANCEL_BEFORE = STAGES[2].at; // free cancellation until the kitchen starts cooking

export function elapsedSec(order, now = Date.now()) {
  return Math.max(0, (now - order.placedAt) / 1000);
}

export function stageIndex(order, now = Date.now()) {
  if (order.cancelledAt) return -1;
  const t = elapsedSec(order, now);
  let idx = 0;
  STAGES.forEach((s, i) => { if (t >= s.at) idx = i; });
  return idx;
}

export function isLive(order, now = Date.now()) {
  const i = stageIndex(order, now);
  return i >= 0 && i < STAGES.length - 1;
}

export function riderProgress(order, now = Date.now()) {
  const t = elapsedSec(order, now);
  if (t <= TRAVEL_START) return 0;
  if (t >= TRAVEL_END) return 1;
  return (t - TRAVEL_START) / (TRAVEL_END - TRAVEL_START);
}

const RIDERS = ['Ravi Kumar', 'Imran Shaikh', 'Suresh Gowda', 'Anil Patil', 'Deepa M', 'Kiran Naik'];
export function riderFor(order) {
  let h = 0;
  for (const ch of order.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return RIDERS[h % RIDERS.length];
}

export const formatTime = (ms) => new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
export const formatDate = (ms) => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
