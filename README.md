# Kirana B2B Marketplace

A React + TypeScript + Vite storefront for a kirana wholesale marketplace aligned with the PRD. The foundation includes the app shell, demo data, navigation, role-based screens, environment handling, reusable UI components, and a mock-first configuration.

## Getting started

1. Install dependencies: `npm install`
2. Optionally copy `.env.example` to `.env.local`. Leave both Supabase variables empty to use browser-only demo mode; set both to connect a Supabase project.
3. For Supabase mode, apply the SQL migrations in `supabase/migrations/` in order using the Supabase SQL editor or CLI.
4. Run the app: `npm run dev`
5. Build for production: `npm run build`
6. To create the super admin in a migrated Supabase project, set `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL`, and a strong `ADMIN_PASSWORD` in `.env.local`, then run `npm run seed:demo`.

## Project structure

- `src/components/` — reusable base UI components
- `src/auth/` — account session and access state
- `src/lib/env.ts` — validated Vite environment configuration and optional Supabase client
- `src/` — application code and demo screens
- `supabase/migrations/` — profile, catalogue, carts, orders, stock safety, transport booking and management, mock payments, disputes, admin operations, payout ledger, and RLS schema
- `netlify/functions/` — payment/webhook handlers
- `docs/` — PRD and decisions

## Notes

- Payment is mock-only. The checkout can simulate success or failure, but it does not charge a payment method or move money. No real payment gateway is connected.
- Without Supabase credentials, demo accounts and approval state are stored in this browser only. Demo password: `demo1234`.
- Supabase Auth registrations require a confirmed email if email confirmation is enabled in the project.
- The seed script uses the Supabase service-role key only in Node, never in the browser. Do not commit `.env.local`.
- The Supabase anon key is public client configuration; never put a service-role key in a `VITE_` variable.

## Phase status

- Phase 1 foundation: complete (scaffold, Tailwind, routing, optional Supabase client, env handling, reusable base UI, CI, Netlify configuration, README, and decisions log)
- Phase 2 auth and role flow: implemented (registration, login, pending/rejected/suspended account screens, admin approval/rejection, blocking profile completion, private bank detail storage, audit log, migration, and super-admin seed script)
- Phase 3 catalogue: implemented (product category/grade/unit masters, wholesaler CRUD and stock availability, compressed product photos, retailer search and filters, wholesaler profiles, and product comparison)
- Phase 4 cart and ordering: implemented (retailer cart, per-wholesaler order splitting, transactional stock checks and decrement, pickup tokens, COD cap, reservation expiry, optional transport-slot booking, and browser-only mock online payment)
- Phase 5 mock payments: implemented (provider interface, authenticated mock success/failure flow, idempotent payment-event logging, and held mock-payout records). Real Razorpay Route payments, linked accounts, transfers, and invoices are intentionally not implemented.
- Phase 6 transport: implemented (audited single/bulk slot management, checkout booking, contact and multi-stop visibility, wholesaler order queue, and scoped self-pickup token verification)
- Phase 7 disputes and notifications: implemented (participant dispute creation and threaded messages, optional private evidence photos, admin review/resolution, mock-payout holds, database-generated Supabase notifications, and a realtime notification center)
- Phase 8 admin dashboard and polish: implemented (live dashboard counts, searchable/paginated all-orders monitor, role/status account management with audited suspension and reinstatement, editable COD and transport settings, category GST reference rates, audit log, responsive navigation and admin controls)

## Order concurrency integration test

The database race test calls `place_order` concurrently as two approved retailer accounts and verifies that exactly one can buy the last unit. It requires a dedicated active Supabase product with stock `1` and minimum order `1` or less, plus two approved retailer accounts with completed profiles. Set the following values in `.env.local` before running `npm run test:order-concurrency`:

- `ORDER_TEST_PRODUCT_ID`
- `ORDER_TEST_RETAILER_ONE_EMAIL` and `ORDER_TEST_RETAILER_ONE_PASSWORD`
- `ORDER_TEST_RETAILER_TWO_EMAIL` and `ORDER_TEST_RETAILER_TWO_PASSWORD`
- `SUPABASE_SERVICE_ROLE_KEY` (used only by this Node test to restore fixture stock and remove its order)

The test restores the fixture product to one unit and removes the test order. Use a dedicated test product and retailer accounts, never production data. Apply migration `004_cart_orders.sql` after the earlier migrations; it schedules online-payment reservation cleanup every minute with `pg_cron`.

## Mock payments

The checkout's online-payment path is a simulation only. In browser-only demo mode, choose either a simulated success or failure; failures release the reserved stock. With Supabase, run through Netlify CLI (`netlify dev`) or deploy the Netlify `mock-payment` function; plain `npm run dev` does not serve Netlify Functions. Set `PAYMENT_PROVIDER=mock`, `SUPABASE_SERVICE_ROLE_KEY`, and the Supabase URL/anon key in the server environment. Apply `005_mock_payments.sql` after `004_cart_orders.sql`. The function verifies the user session and calls a service-role-only RPC; it does not contact a payment gateway, charge customers, create real transfers, or move money. The mock ledger keeps successful wholesaler payouts on hold until the sub-order is completed.

## Transport operations

Apply `006_transport_operations.sql` after the earlier migrations. Super admins can publish, edit, bulk-generate, and disable slots; each administrative change is recorded in `audit_logs`. Defaults for capacity, market hours, slot length, and the publishing horizon are stored in `app_settings`. Retailers can book available slots at checkout, then see the truck contact and their ordered wholesaler pickup stops in order history. Wholesalers see only orders assigned to their shop and can verify self-pickup tokens with payment status or COD due. Browser-only demo schedules and demo audit entries are stored in local browser storage and are not shared across browsers.

## Disputes and notifications

Apply `007_disputes_notifications.sql` after the earlier migrations. Retailers and involved wholesalers can raise order or sub-order disputes, exchange messages, and attach up to five private JPG, PNG, or WebP photos (5 MB each). Super admins can move disputes through review, resolve or reject them, and add notes and thread messages. Open disputes hold related mock payouts; a refund resolution cancels the mock payout record only. This project does not charge, transfer, or refund real money.

The migration creates participant-scoped dispute access and private photo storage, and generates registration, order, transport-booking, and dispute notifications in the database. The notification center supports unread state, realtime updates, and browser-demo notifications. Demo disputes and notifications are local to the browser; demo photos use IndexedDB. Live database behavior requires applying the migration to a configured Supabase project and has not been verified against a live project.

## Admin operations

Apply `008_admin_operations.sql` after migration 007. The super-admin dashboard includes today's order count, an all-orders monitor with status/search filters and 200-order pagination, business-account filtering with audited suspend/reinstate actions, editable COD and transport scheduling defaults, category GST reference rates, and the latest audit events. Grades and units remain the versioned v1 master values. GST rates are recorded for administration only and are not used in checkout or invoices; payments remain mock-only. Settings, category-rate, and account-status changes use super-admin-only database RPCs; demo settings, account changes, and audit entries are stored in this browser. Live RLS/RPC behavior has not been verified against a configured Supabase project.

## Manual QA checklist

- **Retailer:** register and approve an account; complete the profile; search/filter/compare listings; add products from multiple wholesalers; verify cart totals and COD cap; place a mock-online or COD order; book a transport slot or use self-pickup; check order status, pickup details, notifications, and dispute/photo/message flow.
- **Wholesaler:** register and approve an account; complete the profile; create/edit a listing; review only its own incoming orders; verify a pickup token and COD collection state; exchange dispute messages; check order and transport notifications.
- **Super admin:** review and reject/approve registrations; verify dashboard counts; filter users and suspend/reinstate a non-admin account; filter and page through orders; add/edit transport slots; manage disputes and resolutions; change COD/transport defaults; verify audit events and notifications.
- **Supabase setup:** apply migrations `001` through `008` in order, configure Auth/Storage/Realtime and the Netlify mock-payment function, then verify participant isolation and admin RPC authorization with separate retailer, wholesaler, and super-admin accounts. The SQL migrations have not been tested against a live project in this workspace.

The GitHub Actions workflow runs `npm ci`, `npm run lint`, and `npm run build` on pushes and pull requests.
