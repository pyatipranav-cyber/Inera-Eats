import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useStore } from './store.jsx';
import { fetchConfig } from './payments.js';
import { Sheet, useToast } from './ui.jsx';

export default function Account({ onPickAddress }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [config, setConfig] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => { fetchConfig().then(setConfig); }, []);
  const p = state.profile;
  const set = (patch) => dispatch({ type: 'profile', patch });

  let payStatus = 'Checking…';
  if (config) {
    if (!config.reachable) payStatus = 'Payment server not reachable. Checkout runs in demo mode.';
    else if (!config.razorpayEnabled) payStatus = 'Demo mode. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to take real payments.';
    else payStatus = `Razorpay connected (${config.testMode ? 'test mode' : 'live mode'}, key ${config.keyId}).`;
  }

  return (
    <main className="page narrow">
      <h1 style={{ fontSize: 34, padding: '24px 0 8px' }}>Account</h1>
      <div style={{ display: 'grid', gap: 16, marginTop: 12 }}>
        <section className="card" aria-labelledby="ac-p">
          <h2 id="ac-p" style={{ fontSize: 18 }}>Your details</h2>
          <div className="field"><label htmlFor="ac-name">Name</label><input id="ac-name" className="input" autoComplete="name" value={p.name} onChange={(e) => set({ name: e.target.value })} /></div>
          <div className="field"><label htmlFor="ac-phone">Mobile number</label><input id="ac-phone" className="input" inputMode="numeric" maxLength={10} autoComplete="tel-national" value={p.phone} onChange={(e) => set({ phone: e.target.value.replace(/\D/g, '') })} /></div>
          <div className="field"><label htmlFor="ac-email">Email</label><input id="ac-email" className="input" type="email" autoComplete="email" value={p.email} onChange={(e) => set({ email: e.target.value })} /></div>
          <p className="muted small">Saved on this device and used to fill checkout.</p>
        </section>

        <section className="card" aria-labelledby="ac-a">
          <h2 id="ac-a" style={{ fontSize: 18 }}>Saved addresses</h2>
          {state.addresses.length === 0 && <p className="muted">No saved addresses.</p>}
          {state.addresses.map((a) => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
              <div>
                <strong>{a.label}{state.addressId === a.id ? ' (selected)' : ''}</strong>
                <p className="muted small">{a.line1}, {a.area}</p>
              </div>
              <button type="button" className="icon-btn" aria-label={`Delete ${a.label} address`} onClick={() => { dispatch({ type: 'address/remove', id: a.id }); toast('Address deleted'); }}><Trash2 size={18} /></button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost" onClick={onPickAddress}>Add or change address</button>
        </section>

        <section className="card" aria-labelledby="ac-pay">
          <h2 id="ac-pay" style={{ fontSize: 18 }}>Payments</h2>
          <p className="small">{payStatus}</p>
        </section>

        <button type="button" className="btn btn-ghost" style={{ color: 'var(--chili)' }} onClick={() => setConfirmReset(true)}>Clear all app data on this device</button>
      </div>

      <Sheet open={confirmReset} onClose={() => setConfirmReset(false)} title="Clear all app data?" className="dialog">
        <p className="muted" style={{ marginBottom: 18 }}>This removes your cart, order history, addresses and details from this device. It can't be undone.</p>
        <div style={{ display: 'grid', gap: 10 }}>
          <button type="button" className="btn btn-ink btn-block" style={{ background: 'var(--chili)' }} onClick={() => { dispatch({ type: 'reset' }); setConfirmReset(false); toast('App data cleared'); }}>Clear data</button>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => setConfirmReset(false)}>Keep my data</button>
        </div>
      </Sheet>
    </main>
  );
}
