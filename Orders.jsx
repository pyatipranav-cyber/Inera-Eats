import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getItem, getRestaurant, isOpenNow } from './api/_catalog.js';
import { useStore } from './store.jsx';
import { STAGES, formatDate, formatTime, isLive, stageIndex } from './orderflow.js';
import { Empty, Plate, rupees, useToast } from './ui.jsx';

function Status({ order, now }) {
  if (order.cancelledAt) return <span className="status-pill bad">Cancelled</span>;
  const i = stageIndex(order, now);
  if (i === STAGES.length - 1) return <span className="status-pill ok">Delivered</span>;
  return <span className="status-pill live"><span className="live-dot" /> {STAGES[i].label}</span>;
}

export default function Orders() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [now, setNow] = useState(Date.now());
  const anyLive = state.orders.some((o) => isLive(o, now));
  useEffect(() => {
    if (!anyLive) return undefined;
    const t = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(t);
  }, [anyLive]);

  const reorder = (o) => {
    const r = getRestaurant(o.restaurantId);
    if (!r) { toast('This restaurant is no longer available', 'error'); return; }
    if (!isOpenNow(r)) { toast(`${r.name} is closed right now`, 'error'); return; }
    const lines = {};
    for (const l of o.lines) if (getItem(r.id, l.id)) lines[l.id] = l.qty;
    if (!Object.keys(lines).length) { toast('These dishes are no longer on the menu', 'error'); return; }
    dispatch({ type: 'cart/replace', restaurantId: r.id, lines });
    navigate('/cart');
  };

  return (
    <main className="page narrow">
      <h1 style={{ fontSize: 34, padding: '24px 0 8px' }}>Your orders</h1>
      {state.orders.length === 0 ? (
        <Empty emoji="🧾" title="No orders yet" action={<Link to="/" className="btn btn-primary">Order something</Link>}>
          When you place an order, you can track it and reorder it from here.
        </Empty>
      ) : (
        <div style={{ display: 'grid', gap: 14, marginTop: 12 }}>
          {state.orders.map((o) => (
            <article key={o.id} className="card order-card">
              <div className="order-top">
                <Plate emoji={o.art} tint={o.tint} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: 17 }}>{o.restaurantName}</strong>
                  <div className="muted small">{formatDate(o.placedAt)}, {formatTime(o.placedAt)}. {rupees(o.bill.total)}</div>
                </div>
              </div>
              <div className="small muted">{o.lines.map((l) => `${l.qty} × ${l.name}`).join(', ')}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Status order={o} now={now} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Link to={`/order/${o.id}`} className="btn btn-ghost btn-sm">{isLive(o, now) ? 'Track' : 'Details'}</Link>
                  {!isLive(o, now) && <button type="button" className="btn btn-ink btn-sm" onClick={() => reorder(o)}>Reorder</button>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
