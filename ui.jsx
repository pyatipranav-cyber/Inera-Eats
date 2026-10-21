import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Minus, Plus, Star, X } from 'lucide-react';

export const BRAND = 'Inera Eats';
export const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

export function BrandMark({ size = 30 }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill="#241A4A" />
      <circle cx="32" cy="32" r="20" fill="none" stroke="#FFC233" strokeWidth="5" />
      <circle cx="32" cy="32" r="8" fill="#FFC233" />
    </svg>
  );
}

export function Plate({ emoji, tint = '#ffffff', size, className = '', label }) {
  const style = { '--tint': tint };
  if (size) style['--size'] = `${size}px`;
  return (
    <div className={`plate ${className}`} style={style} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <span>{emoji}</span>
    </div>
  );
}

export function VegMark({ veg }) {
  return <span className={`vmark ${veg ? 'veg' : 'nonveg'}`} role="img" aria-label={veg ? 'Vegetarian' : 'Non-vegetarian'} />;
}

export function Rating({ value }) {
  return (
    <span className={`rating ${value < 4.2 ? 'mid' : ''}`} aria-label={`Rated ${value} out of 5`}>
      <Star size={12} fill="currentColor" strokeWidth={0} /> {value.toFixed(1)}
    </span>
  );
}

export function Adder({ qty, onAdd, onInc, onDec, disabled, name }) {
  if (!qty) {
    return (
      <button type="button" className="adder add" onClick={onAdd} disabled={disabled} aria-label={`Add ${name}`}>
        ADD
      </button>
    );
  }
  return (
    <div className="adder qty" role="group" aria-label={`${name} quantity`}>
      <button type="button" onClick={onDec} aria-label={`Remove one ${name}`}><Minus size={16} strokeWidth={3} /></button>
      <output aria-live="polite">{qty}</output>
      <button type="button" onClick={onInc} aria-label={`Add one more ${name}`}><Plus size={16} strokeWidth={3} /></button>
    </div>
  );
}

// Bottom sheet on phones, centred modal on larger screens.
export function Sheet({ open, onClose, title, children, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => ref.current?.querySelector('input, button, [tabindex]')?.focus(), 30);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`sheet ${className}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="sheet-head">
          <h2>{title}</h2>
          {onClose && (
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef();
  const show = useCallback((message, kind = 'info') => {
    clearTimeout(timer.current);
    setToast({ message, kind, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-wrap" aria-live="polite">
        {toast && <div key={toast.key} className={`toast ${toast.kind === 'error' ? 'error' : ''}`}>{toast.message}</div>}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function Empty({ emoji, title, children, action }) {
  return (
    <div className="empty">
      <Plate emoji={emoji} tint="#fff6dd" />
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
