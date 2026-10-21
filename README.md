# Inera Eats — food delivery app

A Swiggy/Zomato-style food delivery web app: browse kitchens, filter and search, add dishes to a cart, apply coupons, pay with **Razorpay** (UPI, cards, netbanking, wallets) or cash on delivery, then track the rider live.

Built with React 18 + Vite on the front end and Vercel serverless functions in `/api` on the back end.

---

## 1. Run it in VS Code

Requires Node.js 18 or newer.

```bash
npm install
npm run dev        # opens http://localhost:5173 — the /api routes run here too
npm test           # 30 tests: pricing, coupons, tampering, Razorpay order + signature
npm run build      # production build into /dist
```

Without Razorpay keys the app runs a clearly labelled **demo checkout** — the whole flow works, no money moves.

## 2. Turn on real Razorpay payments (test mode first)

1. Sign up at **dashboard.razorpay.com** and switch to **Test Mode**.
2. Account & Settings → API Keys → **Generate Test Key**. You get a Key ID (`rzp_test_…`) and a Key Secret.
3. Local: copy `.env.example` to `.env` and paste both values. Restart `npm run dev`.
4. In checkout, pay with Razorpay's test details:
   - UPI ID: `success@razorpay` (succeeds) or `failure@razorpay` (fails)
   - Card: `4111 1111 1111 1111`, any future expiry, any CVV, any OTP

**Never commit `.env`.** It is already in `.gitignore`.

## 3. Push to GitHub

```bash
git init
git add .
git commit -m "Inera Eats: food delivery app with Razorpay"
git branch -M main
git remote add origin https://github.com/<your-username>/inera-eats.git
git push -u origin main
```

(Create the empty repo `inera-eats` on github.com first, without a README.)

## 4. Deploy on Vercel

1. vercel.com → **Add New → Project** → import the `inera-eats` repo.
2. Framework is detected as **Vite**. Leave build settings as they are.
3. **Environment Variables** — add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (skip to deploy in demo mode).
4. Click **Deploy**. Every `git push` redeploys automatically.

If you add or change keys later: Settings → Environment Variables, then **Deployments → Redeploy** (variables only apply to new deployments).

---

## How the payment flow works

```
Browser                         Your server (/api)                    Razorpay
───────                         ──────────────────                    ────────
Pay ₹275  ──POST create-order──▶ re-prices cart from catalogue
                                 (ignores any price the browser sends)
                                 ──POST /v1/orders (amount in paise)──▶
                                 ◀────────────── order_id ────────────
          ◀── order_id, key_id ──
Razorpay Checkout opens ─────────────────── customer pays by UPI / card ──▶
          ◀──────────────────────── payment_id + signature ─────────────
          ──POST verify-payment─▶ HMAC-SHA256(order_id|payment_id, secret)
                                  must equal signature
          ◀── verified ─────────
Order placed → tracking screen
```

Key points, the same as Swiggy and Zomato do it:

- **The server decides the amount.** `api/_pricing.js` is the one source of truth for item total, delivery fee, packaging, 5% GST, ₹10 platform fee, tip and coupon discount.
- **The key secret never reaches the browser.** Only the public Key ID is sent.
- **A payment counts only after signature verification** on the server.

## Files

| File | What it does |
| --- | --- |
| `api/_catalog.js` | 12 restaurants, menus, opening hours |
| `api/_pricing.js` | Bill calculation and coupons (shared by browser and server) |
| `api/_razorpay.js` | Razorpay order creation and signature check (server only) |
| `api/config.js` | `GET` — is Razorpay switched on? |
| `api/create-order.js` | `POST` — prices the cart and creates the Razorpay order |
| `api/verify-payment.js` | `POST` — verifies the payment signature |
| `Home.jsx` | Hero, offers, cravings, filters, sort, restaurant grid |
| `Restaurant.jsx` | Menu with veg/non-veg filter, search, bestsellers, ADD buttons |
| `Checkout.jsx` | Cart, coupons, address, tip, bill, payment |
| `Track.jsx` | Live status timeline, rider map, cancel, rating |
| `Orders.jsx`, `Search.jsx`, `Account.jsx` | History and reorder, search, profile |
| `store.jsx` | Cart and app state (one restaurant per cart) |
| `vite.config.js` | Runs `/api` locally during `npm run dev` |

The `api` folder must stay a folder: Vercel only turns files inside `/api` into serverless functions. Files starting with `_` there are shared code, not public routes.

## Coupons

`WELCOME50` (50% off up to ₹100, min ₹199) · `FLAT75` (min ₹399) · `FREEDEL` (min ₹149) · `FEAST120` (min ₹699). Free delivery applies automatically above ₹499. Cash on delivery is limited to orders up to ₹2,000.

## What is simulated (and what production needs)

This is a complete, working demonstration. Before taking real customers' money, add:

1. **A database** (e.g. Supabase or Postgres) for users, orders and addresses. Right now they live in the browser's localStorage.
2. **Login** with phone OTP.
3. **Razorpay webhooks** (`payment.captured`, `refund.processed`) so an order is confirmed even if the customer closes the tab after paying.
4. **Real refunds** via Razorpay's Refunds API. Cancellation currently shows the refund message only.
5. **Real tracking** from a rider app (websockets + maps). Statuses here advance on a timer.
6. **Live mode keys** after Razorpay KYC, plus your own terms, privacy and refund policy pages (Razorpay requires them for activation).
