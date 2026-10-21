import { useState } from 'react';
import { Briefcase, Home as HomeIcon, MapPin, Plus } from 'lucide-react';
import { useStore } from './store.jsx';
import { Sheet } from './ui.jsx';

const LABELS = ['Home', 'Work', 'Other'];
const iconFor = (label) => (label === 'Home' ? HomeIcon : label === 'Work' ? Briefcase : MapPin);

export default function AddressSheet({ open, onClose }) {
  const { state, dispatch } = useStore();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: 'Home', line1: '', area: '', landmark: '' });
  const [errors, setErrors] = useState({});

  const close = () => { setAdding(false); setErrors({}); onClose(); };

  const save = (e) => {
    e.preventDefault();
    const errs = {};
    if (form.line1.trim().length < 5) errs.line1 = 'Enter your flat, house number and street.';
    if (form.area.trim().length < 3) errs.area = 'Enter your area and city.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    dispatch({ type: 'address/add', address: { id: `a${Date.now().toString(36)}`, ...form, line1: form.line1.trim(), area: form.area.trim(), landmark: form.landmark.trim() } });
    setForm({ label: 'Home', line1: '', area: '', landmark: '' });
    close();
  };

  return (
    <Sheet open={open} onClose={close} title={adding ? 'Add a new address' : 'Deliver to'}>
      {!adding ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {state.addresses.map((a) => {
            const Icon = iconFor(a.label);
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={state.addressId === a.id}
                className="radio-card"
                onClick={() => { dispatch({ type: 'address/select', id: a.id }); close(); }}
              >
                <Icon size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>{a.label}</strong>
                  <p className="muted small">{a.line1}, {a.area}{a.landmark ? `. ${a.landmark}` : ''}</p>
                </div>
              </button>
            );
          })}
          <button type="button" className="btn btn-ghost btn-block" onClick={() => setAdding(true)}><Plus size={18} /> Add a new address</button>
        </div>
      ) : (
        <form onSubmit={save} style={{ display: 'grid', gap: 14 }} noValidate>
          <div className="chips" role="radiogroup" aria-label="Save as">
            {LABELS.map((l) => (
              <button type="button" key={l} className="chip" aria-pressed={form.label === l} onClick={() => setForm({ ...form, label: l })}>{l}</button>
            ))}
          </div>
          <div className="field">
            <label htmlFor="a-line1">Flat, house no., building, street</label>
            <input id="a-line1" className={`input ${errors.line1 ? 'invalid' : ''}`} value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} autoComplete="address-line1" />
            {errors.line1 && <span className="field-error">{errors.line1}</span>}
          </div>
          <div className="field">
            <label htmlFor="a-area">Area, city and PIN code</label>
            <input id="a-area" className={`input ${errors.area ? 'invalid' : ''}`} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} autoComplete="address-level2" />
            {errors.area && <span className="field-error">{errors.area}</span>}
          </div>
          <div className="field">
            <label htmlFor="a-lm">Landmark (optional)</label>
            <input id="a-lm" className="input" value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>Back</button>
            <button type="submit" className="btn btn-ink">Save address</button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
