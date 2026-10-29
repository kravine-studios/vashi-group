# Build prompt for GitHub Copilot: Kirana B2B Marketplace

> How to use: create an empty folder, open it in VS Code, and create a `docs/` folder inside it. Put `PRD-Kirana-B2B-Marketplace.md` in `docs/` and rename it `PRD.md`. Open Copilot Chat in **Agent mode**, attach `docs/PRD.md`, and paste everything below the line. Work phase by phase (Section 9): tell Copilot "Do Phase 1 only" first, review, then continue.

---

## ROLE

You are a senior full-stack engineer. Build the product described in the attached `PRD.md` (Kirana Wholesale–Retail B2B Marketplace, v1) as a working web application. Treat the PRD as the source of truth for behaviour. Where it says "assumption (to confirm)", implement the assumption but make it configurable (see Section 7). Do not add features the PRD lists as non-goals.

## 0. GROUND RULES

- Everything goes **inside the current (empty) folder**, which is the project root. Do not create or touch files outside it. Scaffold into the current folder (for example `npm create vite@latest . -- --template react-ts`), not a nested subfolder.
- Copy `PRD.md` to `docs/PRD.md` if it is not already there, and keep it updated if you make a deliberate deviation (add a "Deviations" section at the end).
- Work in the phases in Section 9. After each phase: make sure `npm run build` and `npm run lint` pass, update `README.md`, and give me a short summary of what exists, what is stubbed, and what I must do manually (keys, SQL to run, etc.). Then stop and wait for me to say "continue".
- Never hard-code secrets. Use `.env.local` for local values, ship `.env.example` with every variable name and a comment, and make sure `.env*` (except `.env.example`) is in `.gitignore`.
- Prefer small, typed, well-named modules over big files. No `any` unless commented. Keep components under about 200 lines.
- If something in the PRD is ambiguous, pick the simplest reasonable option, note it in `docs/DECISIONS.md`, and keep going rather than asking me, unless it blocks the phase.

## 1. TECH STACK (fixed)

- **Frontend:** React 18 + TypeScript + Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form + Zod, lucide-react icons. Mobile-first and responsive (retailers will mostly use phones).
- **Backend / DB:** Supabase: Postgres, Auth, Storage, Realtime, Row Level Security. All schema lives in versioned SQL migrations under `supabase/migrations/`.
- **Server logic that must be trusted** (checkout, stock reservation, payment webhooks, payouts, admin actions): Postgres functions (RPC) where possible, and **Netlify Functions** (`netlify/functions/`) for anything that needs a secret key (payment gateway calls, webhooks).
- **Payments:** Razorpay with **Route** (marketplace split / linked accounts), in **test mode**. Put the gateway behind a `PaymentProvider` interface (`createOrder`, `createLinkedAccount`, `verifyWebhook`, `transferToLinkedAccount`, `refund`) with a `RazorpayProvider` implementation and a `MockProvider` so the whole flow can be demoed with no keys. Selected by `VITE_PAYMENT_PROVIDER=mock|razorpay`.
- **Hosting:** Netlify (include `netlify.toml` with SPA redirect and functions directory).
- Package manager: npm. Node 20.

## 2. ROLES, AUTH AND ACCESS

- Roles: `super_admin`, `wholesaler`, `retailer`. Account status: `pending`, `approved`, `rejected`, `suspended`.
- Login with email + password via Supabase Auth (phone optional field on profile; OTP is a documented future step, not required now).
- Registration collects: company/shop name, address, GST number, FSSAI number, office/shop number, contact details, role (wholesaler or retailer only; nobody can self-register as admin). Validate GST (15-char pattern) and FSSAI (14 digits) format client-side and server-side.
- New users are `pending`: they can log in and see a "Awaiting approval" screen, but cannot list products, order, or see the marketplace.
- Rejected users see the rejection reason. Suspended users are signed out of all actions with a clear message.
- Route guards by role and status. **Enforce everything again in RLS policies**; never rely on UI hiding alone.
- Seed script creating one super admin (email/password from env), plus optional demo data (3 wholesalers, 3 retailers, 40 products across grains, rice, wheat, spices, dry fruits) behind a `npm run seed:demo` command.

## 3. FEATURES TO BUILD (per PRD)

### 3.1 Registration, approval, profile completion (PRD 4.1)
- Pending → admin approve/reject (reject requires a reason) → in-app "successfully registered" pop-up on next load.
- First login after approval shows a **blocking profile-completion modal** (bank account holder, account number, IFSC, shop logo upload, any missing fields). Until complete, wholesalers cannot list and retailers cannot check out. Enforce server-side with a `profile_completed` flag checked in RLS/RPC.
- Store bank details in a separate table readable only by the owner and super admin. Never return them in public queries.

### 3.2 Wholesaler panel (PRD 4.2, 5.3)
- Product CRUD: name, category, 1–5 photos (client-side compression to about 1200px / under 300 KB before upload, Supabase Storage), grade (A/B/C from master data), price per unit, unit type (kg, 25 kg bag, ton from master data), stock, minimum order quantity, active/out-of-stock toggles.
- Incoming sub-orders list with detail: retailer name, shop number, items, amount, payment mode/status, fulfilment type.
- Actions: mark packed, mark handed over, **verify self-pickup token** (input the token, validate, show payment status or cash due before release), **confirm COD cash received**.
- Payout and settlement view, and invoice list/download.

### 3.3 Retailer panel (PRD 4.3, 5.4)
- Catalogue with search and filters (category, grade, price range, wholesaler), wholesaler profile pages.
- **Compare view:** the same product (by category + product name) across wholesalers on price, grade, stock, minimum order.
- Single cart holding items from multiple wholesalers, grouped by wholesaler in the UI. Enforce minimum order quantity and available stock.
- Checkout: choose payment (online / COD) and fulfilment (truck slot / self pickup). Show one combined order with per-wholesaler sub-order breakdown.
- Order history and tracking, token display for self pickup, invoices, raise dispute.

### 3.4 Checkout, order splitting, stock safety (PRD 4.3, 7)
- Implement `place_order(...)` as a **single Postgres function in one transaction**: lock product rows (`SELECT ... FOR UPDATE`), verify stock and min order, create `orders` + one `sub_orders` per wholesaler + items, decrement stock, generate the self-pickup token (short, unique, human-readable, e.g. `KR-7F3K9Q`), and attach the transport booking if chosen. It must be impossible for two retailers to buy the last stock. Add a test proving it (two concurrent calls, one fails).
- If online payment fails or is abandoned, release the stock via a timed expiry (for example 15 minutes) handled by a scheduled Supabase function or a `pg_cron` job.

### 3.5 Payments (PRD 4.4)
- **Online:** one payment from the retailer. Server creates the gateway order with the split (transfers) per wholesaler linked account. On the verified webhook, mark payment paid. Funds are never held in the platform's account.
- Wholesalers are registered as gateway linked accounts after profile completion (bank + KYC). Store the linked-account ID on the business profile. Provide an admin action to retry linked-account creation.
- **Payout hold:** transfers to wholesalers are created with settlement **on hold** and released when the sub-order is marked completed (pickup/delivery confirmed) and no dispute is open. Controlled by config (Section 7).
- **COD:** order stays "Payment pending (COD)" until the wholesaler confirms cash received. Super admin can set a global COD order-value cap and mark individual retailers as COD-trusted or not (config + per-retailer flag).
- **Invoices:** one PDF invoice per sub-order in the wholesaler's name with GST number, FSSAI, retailer details, line items, tax placeholders (GST rate per category in master data), invoice number series per wholesaler. Generate server-side. Add a visible note that final GST/TCS treatment is pending CA confirmation.
- Handle webhooks idempotently (store event IDs). Log every payment event.

### 3.6 Transport and pickup (PRD 4.5)
- Super admin: create, edit, **bulk-create** slots (date range, market hours default 10:00–18:00, slot length, truck/driver name, contact), mark unavailable. Slots can be published up to a configurable number of days ahead.
- Slot statuses: `available`, `booked`, `unavailable`. Capacity defaults to 1 order per slot, admin-overridable per slot.
- Retailer picks an available slot at checkout (booking is part of the `place_order` transaction so two retailers cannot take the same slot) **or** chooses self pickup and gets a token.
- After booking, show the truck contact to the retailer and to each relevant wholesaler. For multi-wholesaler orders, show the retailer an ordered list of stops with each wholesaler's shop number and pickup details.

### 3.7 Disputes (PRD 4.6)
- Retailer or wholesaler raises a dispute on an order or sub-order: reason (from a list), description, optional photos.
- States: Open → Under review → Resolved / Rejected. Super admin sees both sides, adds messages in a thread, and records a resolution (refund, replacement, dismissed) with notes.
- Open dispute puts the sub-order payout on hold; resolution releases or refunds accordingly.

### 3.8 Notifications, in-app only (PRD 4.7)
- `notifications` table + Supabase Realtime subscription. Toast pop-up for live events, a bell icon with unread count and a list, mark read / mark all read. Unread items persist across logins.
- Implement every event in the PRD table (registration submitted/approved/rejected, new order, order status change, slot booked, dispute raised/updated) with the example messages. No email, SMS or WhatsApp.
- Create notifications from database triggers or RPCs, not from the client.

### 3.9 Super admin panel (PRD 5.2)
- Dashboard cards: pending approvals, orders today, open disputes, upcoming transport slots.
- User management (filter by role/status, view GST/FSSAI, approve/reject with reason/suspend/reinstate), transport schedule management, dispute management, all-orders monitor with filters, master data (categories, grades, units, GST rate per category), settings page for config values.
- **Audit log** of every admin action (who, what, target, before/after, timestamp), viewable in the admin panel.

## 4. DATABASE DESIGN

Create migrations for at least: `profiles` (role, status, profile_completed), `business_profiles`, `bank_details`, `categories`, `grades`, `units`, `products`, `product_images`, `carts`, `cart_items`, `orders`, `sub_orders`, `sub_order_items`, `payments`, `payouts`, `transport_slots`, `transport_bookings`, `disputes`, `dispute_messages`, `notifications`, `invoices`, `audit_log`, `app_settings`, `payment_events`. Follow the PRD data model (Section 6) and use enums for statuses, `numeric(12,2)` for money (store amounts in paise as integers if you prefer, but be consistent), `timestamptz` everywhere, foreign keys, indexes on filter columns, and `updated_at` triggers.

RLS rules, in summary: users read/update only their own profile and business data; approved users read active products of approved wholesalers; wholesalers manage only their own products and see only their own sub-orders; retailers see only their own carts and orders; super admin can read everything and perform admin actions through audited RPCs; bank details are owner + admin only. Write SQL tests (or a documented script) that checks cross-tenant access is denied.

## 5. UI / UX

- Clean, trustworthy, fast. Mobile-first with bottom navigation for retailers on phones; sidebar layout on desktop for wholesaler and admin.
- Large tap targets, simple language, ₹ formatting with Indian digit grouping (use `Intl.NumberFormat('en-IN')`).
- Every list has loading skeletons, empty states and error states. Forms show inline validation. Destructive actions need confirmation.
- Accessible: labels, focus states, sufficient contrast, keyboard-friendly modals.
- Optional (nice to have, only after core is done): English + Hindi toggle using i18n keys, so no hard-coded UI strings in components.

## 6. NON-FUNCTIONAL

- HTTPS only in production, input validation on client and server, no sensitive data in logs, rate limit auth and webhook endpoints where feasible.
- Bank/KYC data goes to the gateway where possible; keep stored copies minimal and access-restricted.
- Image upload limits (type, size) enforced client- and server-side (Storage policies).
- Pagination on all large lists (products, orders, users).
- Basic test coverage: unit tests (Vitest) for pricing/splitting/validation helpers, and an integration test for `place_order` concurrency. Add a GitHub Actions workflow running lint, typecheck, test and build.

## 7. CONFIGURABLE ASSUMPTIONS (store in `app_settings`, editable by super admin)

- `payout_release_mode`: `after_completion` (default) | `immediate`
- `hold_payout_on_dispute`: true
- `cod_enabled`: true; `cod_max_order_value`: e.g. 50000; per-retailer `cod_trusted` flag
- `slot_default_capacity`: 1
- `slot_publish_days_ahead`: 3
- `market_open_time` / `market_close_time`: 10:00 / 18:00
- `stock_reservation_minutes`: 15
- `gst_tcs_note_visible`: true

## 8. OUT OF SCOPE (do not build)

Commissions or subscriptions, credit/udhaar ledger, quantity-tier pricing, negotiation or bulk quotes, native apps, WhatsApp/SMS/email notifications, truck delivery to the retailer's shop, automated GST/FSSAI verification, ratings and reviews, analytics. You may leave clean extension points (for example a `notification_channels` abstraction) but do not implement them.

## 9. PHASES (stop after each and wait for "continue")

1. **Foundation:** scaffold in current folder, Tailwind, routing, Supabase client, env handling, folder structure, `README`, `docs/PRD.md`, `docs/DECISIONS.md`, CI workflow, `netlify.toml`, design tokens and base UI components (Button, Input, Modal, Toast, Table, Badge, EmptyState).
2. **Auth, registration, approval, profile completion:** migrations + RLS for profiles/business/bank, registration form, pending/rejected/suspended screens, admin approvals with reason, audit log, blocking profile-completion modal, seed script.
3. **Catalogue:** master data, wholesaler product CRUD with image upload, retailer catalogue, search/filters, wholesaler pages, compare view.
4. **Cart, order splitting, stock safety:** cart, `place_order` transaction, tokens, stock reservation expiry, concurrency test.contin
5. **Payments:** `PaymentProvider` interface, Mock + Razorpay Route, linked accounts, split orders, webhooks, COD flow, payout holds and release, invoices (PDF).
6. **Transport:** slot management (single + bulk), booking inside checkout, truck contact visibility, multi-stop pickup view, token verification screen for wholesalers.
7. **Notifications and disputes:** realtime notifications + bell, all PRD events, dispute flow with admin resolution and payout effects.
8. **Admin dashboard, polish, hardening:** dashboard cards, order monitor, settings page, responsive pass, accessibility pass, empty/error states, RLS review, test run, final README with setup, env variables, deployment to Netlify, and a manual QA checklist covering the three roles end to end.

## 10. DEFINITION OF DONE

- `npm install && npm run dev` works from a clean clone after following the README (including Supabase project setup and running migrations).
- All three roles can complete the full journey: register → approved → profile complete → wholesaler lists products → retailer compares, carts from 2+ wholesalers, pays online (mock or test mode) or COD, books a slot or gets a token → wholesaler verifies token/confirms COD → order completes → payout released → dispute path works.
- RLS verified: no role can read or write another role's private data.
- Build, lint, typecheck and tests pass in CI.

**Start now with Phase 1 only.**
