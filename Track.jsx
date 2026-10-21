import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Phone, Star } from 'lucide-react';
import { useStore } from './store.jsx';
import { CANCEL_BEFORE, STAGES, elapsedSec, formatTime, riderFor, riderProgress, stageIndex } from './orderflow.js';
import { Empty, Plate, VegMark, rupees, useToast } from './ui.jsx';

const ROUTE = 'M 52 186 L 52 132 L 128 132 L 128 84 L 236 84 L 236 52 L 318 52';

function RouteMap({ progress, tint, emoji, delivered }) {
  const pathRef = useRef(null);
  const [len, setLen] = useState(0);
  const [pt, setPt] = useState({ x: 52, y: 186 });
  useLayoutEffect(() => {
    const p = pathRef.current;
    if (!p) return;
    const total = p.getTotalLength();
    setLen(total);
    const q = p.getPointAtLength(total * progress);
    setPt({ x: q.x, y: q.y });
  }, [progress]);

  return (
    <div className="map" role="img" aria-label={delivered ? 'Your order has arrived' : `Rider is ${Math.round(progress * 100)}% of the way to you`}>
      <svg viewBox="0 0 360 230">
        <rect width="360" height="230" fill="#ECE9F6" />
        <path d="M 0 20 C 80 40 140 0 220 18 S 330 10 360 30 L 360 0 L 0 0 Z" fill="#D6E9F5" />
        <rect x="150" y="120" width="80" height="60" rx="14" fill="#DCEFDF" />
        <rect x="270" y="90" width="70" height="44" rx="12" fill="#DCEFDF" />
        {[40, 92, 132, 170, 210].map((y) => <line key={`h${y}`} x1="0" x2="360" y1={y} y2={y} stroke="#fff" strokeWidth="7" />)}
        {[52, 128, 236, 318].map((x) => <line key={`v${x}`} x1={x} x2={x} y1="30" y2="230" stroke="#fff" strokeWidth="7" />)}
        <path ref={pathRef} d={ROUTE} fill="none" stroke="#B9B3D3" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 9" />
        {len > 0 && (
          <path d={ROUTE} fill="none" stroke="#241A4A" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${len * progress} ${len}`} style={{ transition: 'stroke-dasharray 1s linear' }} />
        )}
        <g transform="translate(52 186)">
          <circle r="17" fill={tint} stroke="#241A4A" strokeWidth="3" />
          <text textAnchor="middle" dominantBaseline="central" fontSize="16">{emoji}</text>
        </g>
        <g transform="translate(318 52)">
          <circle r="17" fill="#FFC233" stroke="#241A4A" strokeWidth="3" />
          <text textAnchor="middle" dominantBaseline="central" fontSize="16">🏠</text>
        </g>
        {progress > 0 && progress < 1 && (
          <g style={{ transform: `translate(${pt.x}px, ${pt.y}px)`, transition: 'transform 1s linear' }}>
            <circle r="15" fill="#fff" stroke="#241A4A" strokeWidth="3" />
            <text textAnchor="middle" dominantBaseline="central" fontSize="15">🛵</text>
          </g>
        )}
      </svg>
    </div>
  );
}

export default function Track() {
  const { id } = useParams();
  const { state, dispatch } = useStore();
  const toast = useToast();
  const order = state.orders.find((o) => o.id === id);
  const [now, setNow] = useState(Date.now());

  const idxNow = order ? stageIndex(order, now) : -1;
  const finished = !order || order.cancelledAt || idxNow === STAGES.length - 1;
  useEffect(() => {
    if (finished) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [finished]);

  if (!order) {
    return (
      <main className="page narrow">
        <Empty emoji="🧾" title="Order not found" action={<Link to="/orders" className="btn btn-primary">See your orders</Link>}>
          Orders are saved on this device. It may have been placed from another phone or browser.
        </Empty>
      </main>
    );
  }

  const idx = idxNow;
  const cancelled = Boolean(order.cancelledAt);
  const delivered = idx === STAGES.length - 1;
  const progress = riderProgress(order, now);
  const rider = riderFor(order);
  const canCancel = !cancelled && elapsedSec(order, now) < CANCEL_BEFORE;
  const etaMs = order.placedAt + (32 + Math.round(order.bill.lines.length * 1.5)) * 60000;
  const remaining = Math.max(0, Math.ceil((1 - progress) * (idx >= 3 ? 12 : 30)));

  const cancel = () => {
    dispatch({ type: 'order/update', id: order.id, patch: { cancelledAt: Date.now() } });
    toast(order.payment.status === 'paid' ? `Order cancelled. Refund of ${rupees(order.bill.total)} started.` : 'Order cancelled.');
  };

  let headline;
  if (cancelled) headline = 'Order cancelled';
  else if (delivered) headline = 'Enjoy your meal!';
  else if (idx >= 3) headline = `Arriving in ${remaining} min`;
  else headline = `Arriving by ${formatTime(etaMs)}`;

  return (
    <main className="page narrow">
      <div className="track-hero">
        <p className="muted small">Order #{order.id} from {order.restaurantName}</p>
        <div className="eta" aria-live="polite">{headline}</div>
        {!cancelled && !delivered && <p style={{ fontWeight: 600 }}>{STAGES[idx].label}</p>}
        {cancelled && <p className="muted">{order.payment.status === 'paid' ? `Your refund of ${rupees(order.bill.total)} has been started and usually reaches your account in 5 to 7 working days.` : 'Nothing was charged for this order.'}</p>}
      </div>

      {!cancelled && <RouteMap progress={delivered ? 1 : progress} tint={order.tint} emoji={order.art} delivered={delivered} />}
      {!cancelled && !delivered && <p className="muted small" style={{ marginTop: 8 }}>Demo: order statuses advance automatically every few seconds.</p>}

      <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
        {!cancelled && idx >= 3 && !delivered && (
          <section className="card">
            <div className="rider">
              <div className="avatar" aria-hidden="true">{rider[0]}</div>
              <div style={{ flex: 1 }}>
                <strong>{rider} is on the way</strong>
                <p className="muted small">Your delivery partner</p>
              </div>
              <a href={`tel:+910000000000`} className="icon-btn" aria-label={`Call ${rider}`} onClick={(e) => { e.preventDefault(); toast('Calling is disabled in the demo'); }}><Phone size={18} /></a>
            </div>
          </section>
        )}

        {!cancelled && (
          <section className="card" aria-labelledby="tr-status">
            <h2 id="tr-status" style={{ fontSize: 18 }}>Order status</h2>
            <ol className="steps">
              {STAGES.map((s, i) => {
                const cls = i < idx || delivered ? 'done' : i === idx ? 'current' : '';
                return (
                  <li key={s.key} className={`step ${cls}`}>
                    <span className="step-dot">{cls === 'done' && <Check size={16} strokeWidth={3} />}</span>
                    <span className="step-label">{s.label}{i <= idx && <span className="muted small" style={{ fontWeight: 500 }}> {formatTime(order.placedAt + s.at * 1000)}</span>}</span>
                  </li>
                );
              })}
            </ol>
            {canCancel && (
              <button type="button" className="btn btn-ghost" onClick={cancel}>Cancel order</button>
            )}
          </section>
        )}

        {delivered && !cancelled && (
          <section className="card">
            <h2 style={{ fontSize: 18 }}>How was your food?</h2>
            <div className="stars" role="radiogroup" aria-label="Rate this order">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={order.rating === n}
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  className={order.rating >= n ? 'on' : ''}
                  onClick={() => { dispatch({ type: 'order/update', id: order.id, patch: { rating: n } }); toast('Thanks for rating your order'); }}
                >
                  <Star size={30} fill={order.rating >= n ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="card" aria-labelledby="tr-sum">
          <div className="card-title">
            <Plate emoji={order.art} tint={order.tint} size={48} />
            <h2 id="tr-sum" style={{ fontSize: 18 }}>Order summary</h2>
          </div>
          {order.lines.map((l) => (
            <div key={l.id} className="bill-row" style={{ alignItems: 'center' }}>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><VegMark veg={l.veg} /> {l.qty} × {l.name}</span>
              <span>{rupees(l.lineTotal)}</span>
            </div>
          ))}
          <div className="bill-total"><span>Total</span><span>{rupees(order.bill.total)}</span></div>
          <div className="small" style={{ display: 'grid', gap: 4 }}>
            <span><strong>Payment:</strong> {order.payment.label}{order.payment.paymentId ? ` (${order.payment.paymentId})` : ''}</span>
            <span><strong>Deliver to:</strong> {order.address.label}, {order.address.line1}, {order.address.area}</span>
            {order.instructions.note && <span><strong>Kitchen note:</strong> {order.instructions.note}</span>}
            {order.instructions.dropoff.length > 0 && <span><strong>Instructions:</strong> {order.instructions.dropoff.join(', ')}</span>}
          </div>
        </section>

        <Link to="/" className="btn btn-ghost btn-block">Back to home</Link>
      </div>
    </main>
  );
}
