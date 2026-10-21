import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import { getRestaurant, getItem } from './api/_catalog.js';
import { computeBill, MAX_QTY } from './api/_pricing.js';
import { Sheet } from './ui.jsx';

// All app state lives in the browser (localStorage). This is a demo store:
// in production, orders and addresses belong in a database (see README).
const KEY = 'inera-eats:v1';

const DEFAULT_ADDRESS = {
  id: 'home',
  label: 'Home',
  line1: 'Flat 402, Lakeview Residency, 12th Main',
  area: 'Indiranagar, Bengaluru 560038',
  landmark: 'Near 100 Feet Road',
};

const initial = {
  cart: { restaurantId: null, lines: {} },
  coupon: '',
  tip: 0,
  orders: [],
  addresses: [DEFAULT_ADDRESS],
  addressId: 'home',
  profile: { name: '', phone: '', email: '' },
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial;
    const s = JSON.parse(raw);
    return {
      ...initial,
      ...s,
      cart: { ...initial.cart, ...(s.cart || {}) },
      profile: { ...initial.profile, ...(s.profile || {}) },
      addresses: Array.isArray(s.addresses) && s.addresses.length ? s.addresses : initial.addresses,
      orders: Array.isArray(s.orders) ? s.orders : [],
    };
  } catch {
    return initial;
  }
}

function setQty(state, itemId, qty) {
  const lines = { ...state.cart.lines };
  if (qty <= 0) delete lines[itemId];
  else lines[itemId] = Math.min(qty, MAX_QTY);
  const empty = Object.keys(lines).length === 0;
  return {
    ...state,
    cart: { restaurantId: empty ? null : state.cart.restaurantId, lines },
    coupon: empty ? '' : state.coupon,
  };
}

function reducer(state, a) {
  switch (a.type) {
    case 'cart/add': {
      const base = state.cart.restaurantId === a.restaurantId ? state : { ...state, cart: { restaurantId: a.restaurantId, lines: {} }, coupon: '' };
      return setQty({ ...base, cart: { ...base.cart, restaurantId: a.restaurantId } }, a.itemId, (base.cart.lines[a.itemId] || 0) + 1);
    }
    case 'cart/qty':
      return setQty(state, a.itemId, a.qty);
    case 'cart/replace':
      return { ...state, cart: { restaurantId: a.restaurantId, lines: a.lines }, coupon: '' };
    case 'cart/clear':
      return { ...state, cart: { restaurantId: null, lines: {} }, coupon: '', tip: 0 };
    case 'coupon':
      return { ...state, coupon: a.code };
    case 'tip':
      return { ...state, tip: a.tip };
    case 'order/add':
      return { ...state, orders: [a.order, ...state.orders].slice(0, 50) };
    case 'order/update':
      return { ...state, orders: state.orders.map((o) => (o.id === a.id ? { ...o, ...a.patch } : o)) };
    case 'address/add':
      return { ...state, addresses: [...state.addresses, a.address], addressId: a.address.id };
    case 'address/remove': {
      const addresses = state.addresses.filter((x) => x.id !== a.id);
      return { ...state, addresses, addressId: state.addressId === a.id ? addresses[0]?.id || null : state.addressId };
    }
    case 'address/select':
      return { ...state, addressId: a.id };
    case 'profile':
      return { ...state, profile: { ...state.profile, ...a.patch } };
    case 'reset':
      return initial;
    default:
      return state;
  }
}

const StoreCtx = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  const [conflict, setConflict] = useState(null);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked: app still works in memory */ }
  }, [state]);

  // Like Swiggy/Zomato: one restaurant per cart. Adding from another asks first.
  const addItem = useCallback((restaurantId, itemId) => {
    if (state.cart.restaurantId && state.cart.restaurantId !== restaurantId && Object.keys(state.cart.lines).length) {
      setConflict({ restaurantId, itemId });
      return;
    }
    dispatch({ type: 'cart/add', restaurantId, itemId });
  }, [state.cart]);

  const qtyOf = useCallback((itemId) => state.cart.lines[itemId] || 0, [state.cart.lines]);
  const setItemQty = useCallback((itemId, qty) => dispatch({ type: 'cart/qty', itemId, qty }), []);

  const cartRestaurant = state.cart.restaurantId ? getRestaurant(state.cart.restaurantId) : null;
  const cartItems = useMemo(
    () => Object.entries(state.cart.lines)
      .map(([id, qty]) => ({ id, qty }))
      .filter((l) => cartRestaurant && getItem(cartRestaurant.id, l.id)),
    [state.cart.lines, cartRestaurant],
  );
  const cartCount = cartItems.reduce((n, l) => n + l.qty, 0);
  const cartSubtotal = cartItems.reduce((n, l) => n + getItem(cartRestaurant.id, l.id).price * l.qty, 0);

  const bill = useMemo(() => {
    if (!cartRestaurant || cartItems.length === 0) return null;
    try {
      return computeBill({ restaurantId: cartRestaurant.id, items: cartItems, coupon: state.coupon, tip: state.tip });
    } catch {
      return null;
    }
  }, [cartRestaurant, cartItems, state.coupon, state.tip]);

  const address = state.addresses.find((x) => x.id === state.addressId) || null;

  const value = {
    state, dispatch, addItem, qtyOf, setItemQty,
    cartRestaurant, cartItems, cartCount, cartSubtotal, bill, address,
  };

  const conflictRestaurant = conflict ? getRestaurant(conflict.restaurantId) : null;

  return (
    <StoreCtx.Provider value={value}>
      {children}
      <Sheet open={Boolean(conflict)} onClose={() => setConflict(null)} title="Start a new cart?" className="dialog">
        <p className="muted" style={{ marginBottom: 18 }}>
          Your cart has items from {cartRestaurant?.name}. Adding this dish clears them and starts a cart from {conflictRestaurant?.name}.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          <button
            type="button"
            className="btn btn-ink btn-block"
            onClick={() => {
              dispatch({ type: 'cart/replace', restaurantId: conflict.restaurantId, lines: { [conflict.itemId]: 1 } });
              setConflict(null);
            }}
          >
            Start new cart
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => setConflict(null)}>Keep current cart</button>
        </div>
      </Sheet>
    </StoreCtx.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
