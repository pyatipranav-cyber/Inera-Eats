// Run with: npm test
// Exercises pricing, coupons, tamper protection, COD rules, the Razorpay order
// call (with a mocked network) and payment signature verification.
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { computeBill, BillError } from './api/_pricing.js';
import { expectedSignature } from './api/_razorpay.js';
import { RESTAURANTS, isOpenNow } from './api/_catalog.js';
import config from './api/config.js';
import createOrder from './api/create-order.js';
import verifyPayment from './api/verify-payment.js';

let passed = 0;
const test = async (name, fn) => {
  try { await fn(); passed += 1; console.log(`  ok  ${name}`); }
  catch (e) { console.error(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; }
};

function call(handler, { method = 'POST', body, rawBody, preParsed = false } = {}) {
  const raw = rawBody ?? (body === undefined ? '' : JSON.stringify(body));
  const req = Readable.from(raw ? [Buffer.from(raw)] : []);
  req.method = method;
  req.headers = { 'content-type': 'application/json' };
  if (preParsed) req.body = body; // simulate Vercel's parsed body
  return new Promise((resolve) => {
    const headers = {};
    const res = {
      statusCode: 200,
      setHeader: (k, v) => { headers[k.toLowerCase()] = v; },
      end: (s) => resolve({ status: res.statusCode, headers, json: s ? JSON.parse(s) : null }),
    };
    Promise.resolve(handler(req, res)).catch((e) => resolve({ status: 'threw', error: e }));
  });
}

const openRestaurant = RESTAURANTS.find((r) => isOpenNow(r));
const realFetch = globalThis.fetch;

console.log('\nPricing');
await test('bill math is exact for a simple order', () => {
  const b = computeBill({ restaurantId: 'udupi-tiffin', items: [{ id: 'ut-msd', qty: 2 }, { id: 'ut-fcf', qty: 1 }] });
  // items 99*2+39 = 237; delivery 19+7*2 = 33; packaging 15; gst round((237+15)*0.05)=13; platform 10
  assert.equal(b.itemTotal, 237);
  assert.equal(b.deliveryFee, 33);
  assert.equal(b.gst, 13);
  assert.equal(b.total, 237 + 33 + 15 + 13 + 10);
  assert.equal(b.totalPaise, b.total * 100);
});
await test('free delivery above ₹499', () => {
  const b = computeBill({ restaurantId: 'tandoor-tales', items: [{ id: 'tt-btc', qty: 2 }] });
  assert.equal(b.itemTotal, 698);
  assert.equal(b.deliveryFee, 0);
  assert.ok(b.freeDeliveryReason);
});
await test('WELCOME50 caps at ₹100', () => {
  const b = computeBill({ restaurantId: 'tandoor-tales', items: [{ id: 'tt-btc', qty: 2 }], coupon: 'welcome50' });
  assert.equal(b.discount, 100);
  assert.equal(b.coupon.applied, true);
});
await test('coupon minimum is enforced with a helpful message', () => {
  const b = computeBill({ restaurantId: 'udupi-tiffin', items: [{ id: 'ut-fcf', qty: 1 }], coupon: 'FLAT75' });
  assert.equal(b.coupon.applied, false);
  assert.match(b.coupon.message, /Add items worth ₹360 more/);
});
await test('FREEDEL waives delivery and counts as savings', () => {
  const b = computeBill({ restaurantId: 'dum-darbar', items: [{ id: 'dd-chk', qty: 1 }], coupon: 'FREEDEL' });
  assert.equal(b.deliveryFee, 0);
  assert.equal(b.savings, b.baseDeliveryFee);
});
await test('unknown item from another restaurant is rejected', () => {
  assert.throws(() => computeBill({ restaurantId: 'udupi-tiffin', items: [{ id: 'dd-chk', qty: 1 }] }), BillError);
});
await test('bad quantities are rejected', () => {
  for (const qty of [0, -1, 1.5, 21, '3']) {
    assert.throws(() => computeBill({ restaurantId: 'udupi-tiffin', items: [{ id: 'ut-msd', qty }] }), BillError, `qty ${qty}`);
  }
});
await test('duplicate lines are merged and still capped', () => {
  assert.throws(() => computeBill({ restaurantId: 'udupi-tiffin', items: [{ id: 'ut-msd', qty: 15 }, { id: 'ut-msd', qty: 10 }] }), BillError);
});
await test('negative or huge tips are rejected', () => {
  assert.throws(() => computeBill({ restaurantId: 'udupi-tiffin', items: [{ id: 'ut-msd', qty: 1 }], tip: -20 }), BillError);
  assert.throws(() => computeBill({ restaurantId: 'udupi-tiffin', items: [{ id: 'ut-msd', qty: 1 }], tip: 9999 }), BillError);
});
await test('closed restaurant cannot take orders', () => {
  const r = RESTAURANTS[0];
  const closedTime = new Date(Date.UTC(2026, 0, 1, 21, 0)); // 02:30 IST
  assert.equal(isOpenNow(r, closedTime), false);
  assert.throws(() => computeBill({ restaurantId: r.id, items: [{ id: 'dd-chk', qty: 1 }], enforceHours: true, now: closedTime }), /closed/);
});
await test('every menu item id is unique and priced', () => {
  const ids = new Set();
  for (const r of RESTAURANTS) for (const s of r.menu) for (const i of s.items) {
    assert.ok(!ids.has(i.id), `duplicate ${i.id}`);
    assert.ok(Number.isInteger(i.price) && i.price > 0, `price ${i.id}`);
    ids.add(i.id);
  }
});

console.log('\nAPI: demo mode (no keys)');
delete process.env.RAZORPAY_KEY_ID;
delete process.env.RAZORPAY_KEY_SECRET;
const firstItem = openRestaurant ? openRestaurant.menu[0].items[0] : null;
await test('GET /api/config reports demo mode', async () => {
  const r = await call(config, { method: 'GET' });
  assert.equal(r.status, 200);
  assert.equal(r.json.razorpayEnabled, false);
});
await test('/api/config rejects POST', async () => {
  const r = await call(config, { method: 'POST' });
  assert.equal(r.status, 405);
});
if (openRestaurant) {
  await test('create-order returns demo order with server-priced amount', async () => {
    const r = await call(createOrder, { body: { restaurantId: openRestaurant.id, items: [{ id: firstItem.id, qty: 2 }] } });
    assert.equal(r.status, 200);
    assert.equal(r.json.mode, 'demo');
    const expected = computeBill({ restaurantId: openRestaurant.id, items: [{ id: firstItem.id, qty: 2 }] });
    assert.equal(r.json.amount, expected.totalPaise);
  });
  await test('works with Vercel pre-parsed body', async () => {
    const r = await call(createOrder, { preParsed: true, body: { restaurantId: openRestaurant.id, items: [{ id: firstItem.id, qty: 1 }] } });
    assert.equal(r.status, 200);
  });
  await test('price tampering: client cannot send its own price', async () => {
    const r = await call(createOrder, { body: { restaurantId: openRestaurant.id, items: [{ id: firstItem.id, qty: 1, price: 1 }], amount: 100 } });
    assert.equal(r.json.bill.lines[0].price, firstItem.price);
  });
  await test('expectedTotal mismatch returns 409', async () => {
    const r = await call(createOrder, { body: { restaurantId: openRestaurant.id, items: [{ id: firstItem.id, qty: 1 }], expectedTotal: 1 } });
    assert.equal(r.status, 409);
  });
  await test('invalid coupon blocks the order (422)', async () => {
    const r = await call(createOrder, { body: { restaurantId: openRestaurant.id, items: [{ id: firstItem.id, qty: 1 }], coupon: 'NOPE' } });
    assert.equal(r.status, 422);
  });
  await test('COD allowed under limit', async () => {
    const r = await call(createOrder, { body: { restaurantId: openRestaurant.id, items: [{ id: firstItem.id, qty: 1 }], paymentMethod: 'cod' } });
    assert.equal(r.status, 200);
    assert.equal(r.json.mode, 'cod');
  });
  await test('COD refused above ₹2,000', async () => {
    const r = await call(createOrder, { body: { restaurantId: openRestaurant.id, items: [{ id: firstItem.id, qty: 20 }], paymentMethod: 'cod' } });
    if (computeBill({ restaurantId: openRestaurant.id, items: [{ id: firstItem.id, qty: 20 }] }).total > 2000) assert.equal(r.status, 422);
  });
} else {
  console.log('  (skipped order tests: every demo restaurant is closed at this hour)');
}
await test('malformed JSON returns 400', async () => {
  const r = await call(createOrder, { rawBody: '{oops' });
  assert.equal(r.status, 400);
});
await test('empty cart returns 422', async () => {
  const r = await call(createOrder, { body: { restaurantId: 'udupi-tiffin', items: [] } });
  assert.ok(r.status === 422);
});
await test('verify-payment refuses when keys are missing', async () => {
  const r = await call(verifyPayment, { body: {} });
  assert.equal(r.status, 400);
});

console.log('\nAPI: Razorpay mode (network mocked)');
process.env.RAZORPAY_KEY_ID = 'rzp_test_ABC123xyz';
process.env.RAZORPAY_KEY_SECRET = 'test_secret_123';
await test('config exposes key id but never the secret', async () => {
  const r = await call(config, { method: 'GET' });
  assert.equal(r.json.razorpayEnabled, true);
  assert.equal(r.json.testMode, true);
  assert.ok(!JSON.stringify(r.json).includes('test_secret_123'));
});
if (openRestaurant) {
  await test('create-order calls Razorpay Orders API with correct auth and amount', async () => {
    let seen;
    globalThis.fetch = async (url, init) => {
      seen = { url, init };
      const body = JSON.parse(init.body);
      return new Response(JSON.stringify({ id: 'order_TEST123456', amount: body.amount, currency: 'INR', status: 'created' }), { status: 200 });
    };
    const r = await call(createOrder, { body: { restaurantId: openRestaurant.id, items: [{ id: firstItem.id, qty: 1 }] } });
    globalThis.fetch = realFetch;
    assert.equal(r.status, 200);
    assert.equal(r.json.mode, 'razorpay');
    assert.equal(r.json.orderId, 'order_TEST123456');
    assert.equal(seen.url, 'https://api.razorpay.com/v1/orders');
    assert.equal(seen.init.headers.Authorization, `Basic ${Buffer.from('rzp_test_ABC123xyz:test_secret_123').toString('base64')}`);
    const sent = JSON.parse(seen.init.body);
    assert.equal(sent.currency, 'INR');
    assert.equal(sent.amount, computeBill({ restaurantId: openRestaurant.id, items: [{ id: firstItem.id, qty: 1 }] }).totalPaise);
    assert.ok(Object.values(sent.notes).every((v) => typeof v === 'string'));
  });
  await test('gateway error surfaces as 502 with reason', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ error: { description: 'Authentication failed' } }), { status: 401 });
    const r = await call(createOrder, { body: { restaurantId: openRestaurant.id, items: [{ id: firstItem.id, qty: 1 }] } });
    globalThis.fetch = realFetch;
    assert.equal(r.status, 502);
    assert.match(r.json.error, /Authentication failed/);
  });
}
await test('valid signature verifies', async () => {
  const sig = expectedSignature('order_TEST123456', 'pay_TEST987654', 'test_secret_123');
  const r = await call(verifyPayment, { body: { razorpay_order_id: 'order_TEST123456', razorpay_payment_id: 'pay_TEST987654', razorpay_signature: sig } });
  assert.equal(r.status, 200);
  assert.equal(r.json.verified, true);
});
await test('forged signature is rejected', async () => {
  const sig = expectedSignature('order_TEST123456', 'pay_TEST987654', 'wrong_secret');
  const r = await call(verifyPayment, { body: { razorpay_order_id: 'order_TEST123456', razorpay_payment_id: 'pay_TEST987654', razorpay_signature: sig } });
  assert.equal(r.status, 400);
  assert.equal(r.json.verified, false);
});
await test('signature for a different order is rejected', async () => {
  const sig = expectedSignature('order_OTHER00001', 'pay_TEST987654', 'test_secret_123');
  const r = await call(verifyPayment, { body: { razorpay_order_id: 'order_TEST123456', razorpay_payment_id: 'pay_TEST987654', razorpay_signature: sig } });
  assert.equal(r.status, 400);
});
await test('malformed ids are rejected', async () => {
  const r = await call(verifyPayment, { body: { razorpay_order_id: '../../x', razorpay_payment_id: 'pay', razorpay_signature: 'zz' } });
  assert.equal(r.status, 400);
});

console.log(`\n${passed} tests passed${process.exitCode ? ', some FAILED' : ''}.`);
