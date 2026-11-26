# Hosting on Hostinger (Node.js)

The app keeps using the same Lovable Cloud database, sign-in and file storage, so all data stays exactly the same.

Requires a Hostinger plan with Node.js apps (Business, Cloud or VPS). Basic shared hosting will not work.

## Settings in Hostinger (Websites → Add website → Node.js app → import from GitHub)
- Node version: 20 or 22
- Install command: `npm install`
- Build command: `npm run build:hostinger`
- Start command: `npm start`  (runs `.output/server/index.mjs`)

## Environment variables (add in Hostinger)
Copy from the project's `.env` file:
- VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID
- SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY
Your own keys:
- RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
Not available outside Lovable (features using them stop working on Hostinger):
- SUPABASE_SERVICE_ROLE_KEY — Razorpay webhook/backfill, admin setup, creating users
- LOVABLE_API_KEY — AI features

## After deploy
- Point works.mbacompass.in DNS to Hostinger.
- Set the Razorpay webhook URL to https://works.mbacompass.in/api/public/razorpay-webhook
