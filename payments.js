// Browser side of the payment flow.
//   1. POST /api/create-order  → server prices the cart, creates a Razorpay order
//   2. Razorpay Checkout opens  → customer pays with UPI / card / netbanking / wallet
//   3. POST /api/verify-payment → server checks Razorpay's HMAC signature
// Only after step 3 succeeds is the order treated as paid.

export async function fetchConfig() {
  try {
    const r = await fetch('/api/config', { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(String(r.status));
    const data = await r.json();
    return { reachable: true, ...data };
  } catch {
    return { reachable: false, razorpayEnabled: false, keyId: null, testMode: null };
  }
}

async function postJson(url, payload) {
  let r;
  try {
    r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  } catch {
    throw new Error('No connection to the server. Check your internet and try again.');
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.error || `Request failed (${r.status}).`);
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const createOrder = (payload) => postJson('/api/create-order', payload);
export const verifyPayment = (payload) => postJson('/api/verify-payment', payload);

let scriptPromise = null;
export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.async = true;
      s.onload = () => resolve(true);
      s.onerror = () => { scriptPromise = null; resolve(false); };
      document.body.appendChild(s);
    });
  }
  return scriptPromise;
}

// Resolves with { status: 'paid', response } | { status: 'dismissed' } | { status: 'failed', error }
export function openRazorpay({ keyId, orderId, amount, currency, name, description, prefill, brandColor }) {
  return new Promise((resolve) => {
    let lastError = null;
    const rzp = new window.Razorpay({
      key: keyId,
      order_id: orderId,
      amount,
      currency,
      name,
      description,
      prefill,
      theme: { color: brandColor },
      retry: { enabled: true },
      handler: (response) => resolve({ status: 'paid', response }),
      modal: {
        confirm_close: true,
        ondismiss: () => resolve(lastError ? { status: 'failed', error: lastError } : { status: 'dismissed' }),
      },
    });
    rzp.on('payment.failed', (resp) => {
      lastError = (resp && resp.error && (resp.error.description || resp.error.reason)) || 'Payment failed.';
    });
    rzp.open();
  });
}
