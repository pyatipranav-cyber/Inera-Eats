import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Banknote, BadgePercent, Bike, ChevronRight, CircleCheck, CreditCard, MapPin, ShieldCheck, TicketPercent, UtensilsCrossed } from 'lucide-react';
import { useStore } from './store.jsx';
import { getItem } from './api/_catalog.js';
import { COUPONS, COD_LIMIT, TIP_OPTIONS, computeBill } from './api/_pricing.js';
import { createOrder, fetchConfig, loadRazorpay, openRazorpay, verifyPayment } from './payments.js';
import { Adder, BRAND, Empty, Plate, Sheet, VegMark, rupees, useToast } from './ui.jsx';

const DROPOFF = ['Leave at the door', 'Avoid calling', "Don't ring the bell", 'Pet at home'];
const PHONE = /^[6-9]\d{9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function DemoPaySheet({ pending, onSuccess, onFail, onClose }) {
  const [tab, setTab] = useState('upi');
  const [stage, setStage] = useState('form'); // form | processing | done
  const [upiApp, setUpiApp] = useState('Google Pay');
  useEffect(() => { if (pending) { setStage('form'); setTab('upi'); } }, [pending]);
  if (!pending) return null;

  const pay = () => {
    setStage('processing');
    setTimeout(() => {
      setStage('done');
      setTimeout(() => onSuccess(`pay_demo_${Math.random().toString(36).slice(2, 12)}`, tab), 900);
    }, 1600);
  };

  return (
    <Sheet open onClose={stage === 'form' ? onClose : undefined} title="Demo checkout">
      {stage === 'form' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="notice info"><ShieldCheck size={18} style={{ flexShrink: 0 }} /> Razorpay keys aren't set up yet, so this screen simulates the payment. No money moves.</div>
          <div>
            <div className="muted small">Amount to pay</div>
            <div className="paysheet-amount">{rupees(pending.amount / 100)}</div>
          </div>
          <div className="tabs" role="tablist">
            {[['upi', 'UPI'], ['card', 'Card'], ['nb', 'Netbanking']].map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
          {tab === 'upi' && (
            <div style={{ display: 'grid', gap: 8 }}>
              {['Google Pay', 'PhonePe', 'Paytm', 'BHIM'].map((a) => (
                <button key={a} type="button" role="radio" aria-checked={upiApp === a} className="radio-card" onClick={() => setUpiApp(a)}>
                  <span className="dot" /> <strong>{a}</strong>
                </button>
              ))}
            </div>
          )}
          {tab === 'card' && (
            <div style={{ display: 'grid', gap: 10 }}>
              <div className="field"><label htmlFor="dc-num">Card number</label><input id="dc-num" className="input" defaultValue="4111 1111 1111 1111" inputMode="numeric" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="field"><label htmlFor="dc-exp">Expiry</label><input id="dc-exp" className="input" defaultValue="12/30" /></div>
                <div className="field"><label htmlFor="dc-cvv">CVV</label><input id="dc-cvv" className="input" defaultValue="123" inputMode="numeric" /></div>
              </div>
              <p className="muted small">This is a test card number. Nothing is charged.</p>
            </div>
          )}
          {tab === 'nb' && (
            <div className="field">
              <label htmlFor="dc-bank">Bank</label>
              <select id="dc-bank" className="input" defaultValue="SBI">
                {['SBI', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak', 'Canara Bank'].map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
          )}
          <button type="button" className="btn btn-primary btn-block" onClick={pay}>Pay {rupees(pending.amount / 100)}</button>
          <button type="button" className="btn-text" style={{ justifySelf: 'center' }} onClick={onFail}>Simulate a failed payment</button>
        </div>
      )}
      {stage === 'processing' && (
        <div className="empty" style={{ padding: '40px 0' }}>
          <div className="spinner" />
          <h2>Confirming with your bank</h2>
          <p>Don't close this screen.</p>
        </div>
      )}
      {stage === 'done' && (
        <div className="empty" style={{ padding: '40px 0' }}>
          <CircleCheck size={64} color="var(--leaf)" />
          <h2>Payment successful</h2>
        </div>
      )}
    </Sheet>
  );
}

export default function Checkout({ onPickAddress }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { state, dispatch, cartRestaurant: r, cartItems, bill, address, setItemQty, qtyOf } = useStore();
  const [config, setConfig] = useState(null);
  const [method, setMethod] = useState('online');
  const [couponOpen, setCouponOpen] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [note, setNote] = useState('');
  const [noCutlery, setNoCutlery] = useState(true);
  const [dropoff, setDropoff] = useState([]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [demo, setDemo] = useState(null);

  useEffect(() => { fetchConfig().then(setConfig); }, []);
  const codAllowed = bill ? bill.total <= COD_LIMIT : true;
  useEffect(() => { if (!codAllowed && method === 'cod') setMethod('online'); }, [codAllowed, method]);

  if (!r || !bill) {
    return (
      <main className="page narrow">
        <Empty emoji="🛒" title="Your cart is empty" action={<Link className="btn btn-primary" to="/">Browse kitchens</Link>}>
          Add dishes from any kitchen and they'll show up here.
        </Empty>
      </main>
    );
  }

  const profile = state.profile;
  const setProfile = (patch) => {
    dispatch({ type: 'profile', patch });
    const keys = Object.keys(patch);
    if (keys.some((k) => errors[k])) setErrors((e) => { const n = { ...e }; keys.forEach((k) => delete n[k]); return n; });
  };
  const couponBroken = bill.coupon && !bill.coupon.applied;

  const applyCode = (raw) => {
    const c = String(raw).trim().toUpperCase();
    if (!c) return;
    const test = computeBill({ restaurantId: r.id, items: cartItems, coupon: c, tip: state.tip });
    if (!test.coupon.applied) { setCodeError(test.coupon.message); return; }
    dispatch({ type: 'coupon', code: c });
    setCodeError('');
    setCode('');
    setCouponOpen(false);
    toast(`${c} applied. You save ${rupees(test.savings)}`);
  };

  const validate = () => {
    const e = {};
    if (!profile.name.trim()) e.name = 'Enter your name for the rider.';
    if (!PHONE.test(profile.phone.trim())) e.phone = 'Enter a 10-digit mobile number.';
    if (profile.email.trim() && !EMAIL.test(profile.email.trim())) e.email = 'Enter a valid email or leave it empty.';
    if (!address) e.address = 'Add a delivery address.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const finish = (created, payment) => {
    const order = {
      id: created.receipt,
      restaurantId: r.id,
      restaurantName: r.name,
      tint: r.tint,
      art: r.art[0],
      lines: created.bill.lines,
      bill: created.bill,
      address,
      contact: { name: profile.name.trim(), phone: profile.phone.trim() },
      instructions: { note: note.trim(), dropoff, noCutlery },
      payment,
      placedAt: Date.now(),
    };
    dispatch({ type: 'order/add', order });
    dispatch({ type: 'cart/clear' });
    navigate(`/order/${order.id}`, { replace: true });
  };

  const fail = (msg) => { setError(msg); toast(msg, 'error'); };
  const place = async () => {
    setError('');
    if (couponBroken) { fail(`${bill.coupon.message} Remove the coupon or add more items.`); return; }
    if (!validate()) { fail('A few details are missing. Check the highlighted fields.'); return; }
    setBusy(true);
    const payload = { restaurantId: r.id, items: cartItems, coupon: state.coupon, tip: state.tip, paymentMethod: method, expectedTotal: bill.total };
    let created;
    try {
      if (config && config.reachable) {
        created = await createOrder(payload);
      } else {
        // No API (static preview only): price locally and use demo checkout.
        const receipt = `IE${Date.now().toString(36).toUpperCase()}`;
        created = method === 'cod'
          ? { mode: 'cod', receipt, bill }
          : { mode: 'demo', receipt, bill, orderId: `demo_${receipt}`, amount: bill.totalPaise, currency: 'INR' };
      }
    } catch (e) {
      setBusy(false);
      fail(e.message);
      return;
    }

    if (created.mode === 'cod') {
      finish(created, { method: 'cod', status: 'pending', label: 'Cash on delivery' });
      return;
    }
    if (created.mode === 'demo') {
      setBusy(false);
      setDemo(created);
      return;
    }

    // Real Razorpay checkout
    const ok = await loadRazorpay();
    if (!ok) { setBusy(false); fail("Couldn't load Razorpay checkout. Check your internet connection and try again."); return; }
    const result = await openRazorpay({
      keyId: created.keyId,
      orderId: created.orderId,
      amount: created.amount,
      currency: created.currency,
      name: BRAND,
      description: `Order from ${r.name}`,
      prefill: { name: profile.name.trim(), contact: `+91${profile.phone.trim()}`, email: profile.email.trim() || undefined },
      brandColor: '#241A4A',
    });
    if (result.status === 'dismissed') { setBusy(false); toast('Payment cancelled. Your cart is still here.'); return; }
    if (result.status === 'failed') { setBusy(false); fail(`Payment failed: ${result.error} If any amount was debited, your bank reverses it automatically.`); return; }
    try {
      const v = await verifyPayment(result.response);
      finish(created, { method: 'razorpay', status: 'paid', paymentId: v.paymentId, gatewayOrderId: v.orderId, label: 'Paid online via Razorpay' });
    } catch (e) {
      setBusy(false);
      fail(`We couldn't confirm this payment (${e.message}). Payment ID: ${result.response.razorpay_payment_id}. Keep it for support.`);
    }
  };

  const payLabel = method === 'cod' ? `Place order, pay ${rupees(bill.total)} on delivery` : `Pay ${rupees(bill.total)}`;

  return (
    <main className="page co-page">
      <div className="co-grid">
        <div style={{ display: 'grid', gap: 16 }}>
          <section className="card" aria-labelledby="co-items">
            <div className="card-title">
              <Plate emoji={r.art[0]} tint={r.tint} size={52} />
              <div>
                <h2 id="co-items" style={{ fontSize: 20 }}>{r.name}</h2>
                <p className="muted small">{r.area}. Delivery in {r.eta}–{r.eta + 8} mins</p>
              </div>
            </div>
            {cartItems.map((l) => {
              const item = getItem(r.id, l.id);
              const qty = qtyOf(l.id);
              return (
                <div key={l.id} className="line">
                  <VegMark veg={item.veg} />
                  <span className="line-name">{item.name}</span>
                  <Adder name={item.name} qty={qty} onInc={() => setItemQty(l.id, qty + 1)} onDec={() => setItemQty(l.id, qty - 1)} />
                  <span style={{ minWidth: 56, textAlign: 'right', fontWeight: 600 }}>{rupees(item.price * qty)}</span>
                </div>
              );
            })}
            <Link to={`/r/${r.id}`} className="btn-text" style={{ justifySelf: 'start' }}>Add more items</Link>
            <div className="field">
              <label htmlFor="co-note">Note for the kitchen</label>
              <textarea id="co-note" className="input" maxLength={200} placeholder="Less spicy, no onions, extra chutney…" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <button type="button" className="toggle" aria-pressed={noCutlery} onClick={() => setNoCutlery(!noCutlery)} style={{ justifySelf: 'start' }}>
              <span className="knob" /> <UtensilsCrossed size={15} /> Don't send cutlery
            </button>
          </section>

          <section className="card" aria-labelledby="co-offers">
            <div className="card-title"><TicketPercent size={22} /><h2 id="co-offers" style={{ fontSize: 18 }}>Offers</h2></div>
            {state.coupon ? (
              <div className={`coupon-row ${bill.coupon?.applied ? 'applied' : ''}`}>
                <div>
                  <strong>{state.coupon}</strong>
                  <div className="small">{bill.coupon?.applied ? `You save ${rupees(bill.savings)} on this order` : bill.coupon?.message}</div>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'coupon', code: '' })}>Remove</button>
              </div>
            ) : (
              <button type="button" className="coupon-row" style={{ background: 'none', width: '100%', textAlign: 'left' }} onClick={() => setCouponOpen(true)}>
                <span style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 600 }}><BadgePercent size={18} /> Apply a coupon</span>
                <ChevronRight size={18} />
              </button>
            )}
          </section>

          <section className="card" aria-labelledby="co-addr">
            <div className="card-title"><MapPin size={22} /><h2 id="co-addr" style={{ fontSize: 18 }}>Delivery address</h2></div>
            {address ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <strong>{address.label}</strong>
                  <p className="muted small">{address.line1}, {address.area}{address.landmark ? `. ${address.landmark}` : ''}</p>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={onPickAddress}>Change</button>
              </div>
            ) : (
              <button type="button" className="btn btn-ghost" onClick={onPickAddress}>Add a delivery address</button>
            )}
            {errors.address && <span className="field-error">{errors.address}</span>}
            <div>
              <div className="small" style={{ fontWeight: 600, marginBottom: 8 }}>Delivery instructions</div>
              <div className="chips" style={{ flexWrap: 'wrap' }}>
                {DROPOFF.map((d) => (
                  <button key={d} type="button" className="chip" aria-pressed={dropoff.includes(d)} onClick={() => setDropoff(dropoff.includes(d) ? dropoff.filter((x) => x !== d) : [...dropoff, d])}>{d}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div className="field">
                <label htmlFor="co-name">Your name</label>
                <input id="co-name" className={`input ${errors.name ? 'invalid' : ''}`} autoComplete="name" value={profile.name} onChange={(e) => setProfile({ name: e.target.value })} />
                {errors.name && <span className="field-error">{errors.name}</span>}
              </div>
              <div className="field">
                <label htmlFor="co-phone">Mobile number</label>
                <input id="co-phone" className={`input ${errors.phone ? 'invalid' : ''}`} inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder="10 digits" value={profile.phone} onChange={(e) => setProfile({ phone: e.target.value.replace(/\D/g, '') })} />
                {errors.phone && <span className="field-error">{errors.phone}</span>}
              </div>
              <div className="field">
                <label htmlFor="co-email">Email for receipt (optional)</label>
                <input id="co-email" className={`input ${errors.email ? 'invalid' : ''}`} type="email" autoComplete="email" value={profile.email} onChange={(e) => setProfile({ email: e.target.value })} />
                {errors.email && <span className="field-error">{errors.email}</span>}
              </div>
            </div>
          </section>

          <section className="card" aria-labelledby="co-tip">
            <div className="card-title"><Bike size={22} /><h2 id="co-tip" style={{ fontSize: 18 }}>Tip your delivery partner</h2></div>
            <p className="muted small">The full tip goes to your rider.</p>
            <div className="tips" role="radiogroup" aria-labelledby="co-tip">
              {TIP_OPTIONS.map((t) => (
                <button key={t} type="button" className="chip" aria-pressed={state.tip === t} onClick={() => dispatch({ type: 'tip', tip: t })}>{t === 0 ? 'No tip' : rupees(t)}</button>
              ))}
            </div>
          </section>
        </div>

        <aside className="co-aside" style={{ display: 'grid', gap: 16 }}>
          <section className="card" aria-labelledby="co-bill">
            <h2 id="co-bill" style={{ fontSize: 18 }}>Bill details</h2>
            <div className="bill">
              <div className="bill-row"><span>Item total</span><span>{rupees(bill.itemTotal)}</span></div>
              {bill.discount > 0 && <div className="bill-row save"><span>Coupon discount ({state.coupon})</span><span>−{rupees(bill.discount)}</span></div>}
              <div className="bill-row">
                <span>Delivery fee, {r.distanceKm} km</span>
                <span>{bill.deliveryFee === 0 ? <><span className="strike">{rupees(bill.baseDeliveryFee || 19 + 7 * Math.ceil(r.distanceKm))}</span><strong style={{ color: 'var(--leaf)' }}>FREE</strong></> : rupees(bill.deliveryFee)}</span>
              </div>
              {bill.freeDeliveryReason && <div className="small muted" style={{ marginTop: -6 }}>{bill.freeDeliveryReason}</div>}
              <div className="bill-row"><span>Platform fee</span><span>{rupees(bill.platformFee)}</span></div>
              <div className="bill-row"><span>Packaging</span><span>{rupees(bill.packaging)}</span></div>
              <div className="bill-row"><span>GST (5%)</span><span>{rupees(bill.gst)}</span></div>
              {bill.tip > 0 && <div className="bill-row"><span>Delivery tip</span><span>{rupees(bill.tip)}</span></div>}
              <div className="bill-total"><span>To pay</span><span>{rupees(bill.total)}</span></div>
            </div>
            {bill.savings > 0 && <div className="savings-band">You save {rupees(bill.savings)} on this order</div>}
          </section>

          <section className="card" aria-labelledby="co-pay">
            <h2 id="co-pay" style={{ fontSize: 18 }}>Pay with</h2>
            <div role="radiogroup" aria-labelledby="co-pay" style={{ display: 'grid', gap: 10 }}>
              <button type="button" role="radio" aria-checked={method === 'online'} className="radio-card" onClick={() => setMethod('online')}>
                <span className="dot" />
                <div>
                  <strong style={{ display: 'flex', gap: 8, alignItems: 'center' }}><CreditCard size={18} /> Pay online</strong>
                  <div className="pay-logos"><span>UPI</span><span>Cards</span><span>Netbanking</span><span>Wallets</span></div>
                </div>
              </button>
              <button type="button" role="radio" aria-checked={method === 'cod'} disabled={!codAllowed} className="radio-card" onClick={() => setMethod('cod')} style={codAllowed ? undefined : { opacity: 0.5, cursor: 'not-allowed' }}>
                <span className="dot" />
                <div>
                  <strong style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Banknote size={18} /> Cash on delivery</strong>
                  <div className="muted small">{codAllowed ? 'Pay the rider in cash or UPI at your door' : `Available on orders up to ${rupees(COD_LIMIT)}`}</div>
                </div>
              </button>
            </div>
            {config && method === 'online' && (
              config.razorpayEnabled ? (
                <p className="small muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <ShieldCheck size={16} /> Secured by Razorpay{config.testMode ? ' (test mode: use test cards or UPI success@razorpay)' : ''}
                </p>
              ) : (
                <div className="notice info small"><ShieldCheck size={16} style={{ flexShrink: 0 }} /> Demo payments are on. Add Razorpay keys to accept real payments.</div>
              )
            )}
          </section>

          {error && <div className="notice" role="alert" style={{ background: 'var(--chili-soft)', color: 'var(--chili)' }}>{error}</div>}

          <div className="co-paybar">
            <button type="button" className="btn btn-primary btn-block" onClick={place} disabled={busy || !config} style={{ height: 56, fontSize: 17 }}>
              {busy ? 'Processing…' : !config ? 'Loading…' : payLabel}
            </button>
          </div>
        </aside>
      </div>

      <Sheet open={couponOpen} onClose={() => { setCouponOpen(false); setCodeError(''); }} title="Apply a coupon">
        <form onSubmit={(e) => { e.preventDefault(); applyCode(code); }} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <label htmlFor="cp-code" className="sr-only">Coupon code</label>
          <input id="cp-code" className={`input ${codeError ? 'invalid' : ''}`} placeholder="Enter coupon code" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeError(''); }} />
          <button type="submit" className="btn btn-ink" disabled={!code.trim()}>Apply</button>
        </form>
        {codeError && <p className="field-error" style={{ marginBottom: 10 }}>{codeError}</p>}
        <div className="coupon-list" style={{ marginTop: 14 }}>
          {COUPONS.map((c) => {
            const t = computeBill({ restaurantId: r.id, items: cartItems, coupon: c.code, tip: state.tip });
            return (
              <div key={c.code} className="coupon-row">
                <div>
                  <span className="code-tag">{c.code}</span>
                  <div style={{ fontWeight: 700, marginTop: 6 }}>{c.title}</div>
                  <div className="small muted">{t.coupon.applied ? `Save ${rupees(t.savings)} on this order` : t.coupon.message}</div>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" disabled={!t.coupon.applied} onClick={() => applyCode(c.code)}>Apply</button>
              </div>
            );
          })}
        </div>
      </Sheet>

      <DemoPaySheet
        pending={demo}
        onClose={() => { setDemo(null); toast('Payment cancelled. Your cart is still here.'); }}
        onFail={() => { setDemo(null); fail('Payment failed: the bank declined this demo payment. Try again or choose cash on delivery.'); }}
        onSuccess={(paymentId, via) => {
          const created = demo;
          setDemo(null);
          finish(created, { method: 'demo', status: 'paid', paymentId, gatewayOrderId: created.orderId, label: `Paid via ${via === 'upi' ? 'UPI' : via === 'card' ? 'card' : 'netbanking'} (demo)` });
        }}
      />
    </main>
  );
}
