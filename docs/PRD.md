# PRD: Kirana Wholesale–Retail B2B Marketplace (v1)

Version 1.0 (draft) · Web application · Launch market: Vashi, Mumbai

## 1. Overview

A B2B web platform that brings wholesalers and kirana retailers of grains, rice, wheat, spices, dry fruits and similar staples onto one online marketplace. Today a retailer travels 2–4 hours to a wholesale market such as Vashi, compares prices shop by shop, pays, and arranges transport, which can take 2–3 days per restocking trip. The platform lets the retailer browse verified wholesalers, compare fixed wholesale prices, order from several wholesalers in one checkout, and arrange pickup through a super-admin-managed transport schedule.

## 2. Goals and non-goals

**Goals (v1)**
- Let verified wholesalers list products with price, grade and stock.
- Let verified retailers browse, compare, cart and order from multiple wholesalers at once.
- Support online payment (with automatic split to each wholesaler) and COD.
- Provide a transport slot system run by the super admin.
- Give the super admin control over approvals, transport and disputes.

**Non-goals (v1)**
- Revenue model, commissions or subscriptions (project is delivered for a fixed fee).
- Credit / udhaar ledgers (to be discussed with the client later).
- Quantity-tier pricing, negotiation or bulk quote requests.
- Native mobile apps, WhatsApp/SMS/email notifications.

## 3. User roles

| Role | Description | Key abilities |
| --- | --- | --- |
| Super Admin | Platform operator | Approve/reject registrations, manage transport slots, resolve disputes, view all orders and users |
| Wholesaler | Seller in the market | List products, manage stock and prices, receive and fulfil orders, receive payouts |
| Retailer | Kirana shop buyer | Browse, cart, order, pay, choose pickup method, raise disputes |

## 4. Core user flows

### 4.1 Registration and approval
- Wholesaler or retailer registers with: company/shop name, address, GST number, FSSAI number, office/shop number, contact details.
- Account enters **Pending** state; the user cannot list or order yet.
- Super admin reviews the details and **approves or rejects** (rejection requires a reason shown to the user).
- On approval the user sees an in-app pop-up confirming successful registration.
- On first login after approval, a **mandatory profile-completion pop-up** collects bank details, shop logo and any remaining details. Listing (wholesaler) and ordering (retailer) stay locked until completed.

### 4.2 Wholesaler listing
- Wholesaler creates a product: name, category, photo(s), quality grade (e.g. A / B), price per unit, unit type (kg, 25 kg bag, ton), available stock, minimum order quantity.
- Wholesaler can edit price and stock, or mark items out of stock or inactive.
- Stock decreases automatically when an order is confirmed.

### 4.3 Retailer ordering
- Retailer browses wholesalers and products, with search and filters (category, grade, price, wholesaler).
- Same product from different wholesalers can be compared on price, grade and stock.
- Retailer adds items from one or more wholesalers to a single cart. Prices are fixed per listing.
- Checkout splits the cart into **sub-orders, one per wholesaler**; the retailer sees one combined order with per-wholesaler breakdown.
- Retailer chooses payment (online or COD) and a fulfilment option (Section 4.5).

### 4.4 Payment

**Online payment**
- One payment collected from the retailer through a payment gateway that supports marketplace split settlements.
- Each wholesaler is registered as a linked account using their bank details and KYC from profile completion.
- Example: cart of ₹100 = Wholesaler A ₹50 + B ₹30 + D ₹20. The retailer pays ₹100 once; the gateway settles ₹50, ₹30 and ₹20 to the respective bank accounts.
- The platform does not hold funds in its own account.
- Assumption (to confirm): payout to a wholesaler is released after delivery/pickup is confirmed, giving a dispute window.

**COD**
- Retailer pays cash on pickup/delivery directly to the wholesaler.
- Order is marked *Payment pending (COD)* and closed by the wholesaler confirming cash received.
- Assumption (to confirm): COD may be restricted to trusted retailers or capped by order value, set by super admin.

**Invoicing**
- One invoice per sub-order, issued in the wholesaler's name with GST details.
- Final GST/TCS treatment to be confirmed with the client's CA before launch.

### 4.5 Transport and pickup

Super admin manages a **transport schedule** in advance.
- Super admin publishes availability for upcoming market days (can be set 2–3 days ahead), within market hours (e.g. 10:00–18:00).
- Each entry is a time slot with: date, time range, truck/driver name, contact number, status (available / booked / unavailable). Example: 10:00–12:00 available, 12:00–13:00 not available.

At checkout, the retailer chooses one of:
- **Book a truck slot** from the available slots.
- **Self pickup**: retailer sends their own person. The system generates a **unique token number** for the order. The wholesaler verifies the token (and payment status or cash) before releasing goods.

After booking:
- The truck contact number is shown to **both** the retailer and the relevant wholesalers.
- For multi-wholesaler orders, the retailer sees each wholesaler's shop number and pickup details, so they can brief the driver on the stops (shop A, shop B, shop C).
- Slot becomes *Booked* and is no longer offered to others (capacity of one order per slot in v1, unless super admin allows more).

### 4.6 Returns and disputes
- Either the retailer or the wholesaler can raise a dispute against an order or sub-order, with reason, description and optional photos.
- The dispute goes to the super admin, who reviews both sides, communicates with them and records a resolution (e.g. refund, replacement, dismissed).
- Dispute states: Open → Under review → Resolved / Rejected.
- Payout for the affected sub-order stays on hold while the dispute is open (assumption).

### 4.7 Notifications (in-app only)

Notifications are web pop-ups plus a notification bell list, shown while the user is on the site.

| Event | Recipient | Example message |
| --- | --- | --- |
| Registration submitted | Super admin | New wholesaler/retailer awaiting approval |
| Registration approved | Wholesaler / Retailer | You have been successfully registered in this community |
| Registration rejected | Wholesaler / Retailer | Registration rejected, reason shown |
| New order | Wholesaler | "[Retailer name], Shop [no.] has placed an order of ₹X" |
| Order status change | Retailer | Confirmed / packed / ready / completed |
| Transport slot booked | Super admin, wholesalers, retailer | Slot and driver contact |
| Dispute raised / updated | Super admin, counterparty | Dispute opened or resolved |

Unread notifications persist and are visible at next login.

## 5. Functional requirements by module

### 5.1 Authentication and accounts
- Email or phone + password login (OTP verification at registration recommended).
- Role-based access control for the three roles.
- Account states: Pending, Approved, Rejected, Suspended.

### 5.2 Super admin panel
- Dashboard: pending approvals, orders today, open disputes, upcoming transport slots.
- User management: view details, approve/reject/suspend, review GST and FSSAI numbers.
- Transport schedule management (create, edit, bulk-create slots, mark unavailable).
- Dispute management.
- Order monitoring across all wholesalers and retailers.
- Category and unit master data.

### 5.3 Wholesaler panel
- Profile and bank details, shop logo.
- Product management (add, edit, photos, price, stock, grade).
- Incoming orders with order detail, retailer name and shop number, token verification for self-pickup.
- Mark order packed / handed over; confirm COD cash received.
- Payout and settlement view; invoices.

### 5.4 Retailer panel
- Browse and search products and wholesaler profiles.
- Cart, checkout, payment, transport booking.
- Order history and tracking, token display, invoices.
- Raise disputes.

## 6. Data model (high level)

- **User** (role, status, credentials)
- **BusinessProfile** (name, address, GST, FSSAI, shop number, logo, bank details, gateway linked-account ID)
- **Category**, **Product** (wholesaler, grade, price, unit, stock, images)
- **Cart**, **CartItem**
- **Order** (retailer, payment mode, payment status, fulfilment type, token) and **SubOrder** (wholesaler, items, amount, status, payout status)
- **Payment** and **Payout** records (gateway references, split amounts)
- **TransportSlot** (date, start/end time, driver, contact, status) and **TransportBooking**
- **Dispute** (order/sub-order, raised by, reason, status, resolution)
- **Notification** (recipient, type, payload, read status)
- **Invoice**

## 7. Non-functional requirements

- Responsive web design that works on phones, since many retailers will use mobile browsers; native apps out of scope.
- Secure storage of business and bank details; bank/KYC data handled through the payment gateway where possible.
- HTTPS, input validation, audit log of admin actions (approvals, dispute decisions).
- Image upload limits and compression for product photos.
- Real-time or near real-time in-app notifications (WebSocket or polling).
- Transactional stock handling so two retailers cannot buy the same last stock.

## 8. Assumptions and items to confirm

- Payment gateway with split settlements will be used; final provider and fees to be confirmed.
- Payout release timing (after delivery confirmation) and COD restrictions are proposals, not yet agreed.
- GST invoicing and any TCS obligations to be verified with a chartered accountant.
- Verification of GST and FSSAI numbers in v1 is manual by the super admin; automated verification can come later.
- One truck slot carries one order in v1.
- Delivery to the retailer's shop by truck is out of scope; v1 covers pickup from wholesaler shops by truck or the retailer's own person.

## 9. Future scope (post-v1)

- Credit / udhaar ledger and payment terms for trusted retailers.
- Commission or subscription revenue model.
- Quantity-tier pricing and bulk quote requests.
- WhatsApp/SMS/email notifications.
- Mobile app, additional markets and cities.
- Ratings and reviews for wholesalers.
- Analytics and reports for all three roles.

## 10. Suggested milestones

1. Design: wireframes and UI for the three panels.
2. Auth, registration, approval and profile completion.
3. Product listing and catalogue browsing.
4. Cart, order splitting and payment integration (including split settlement).
5. Transport schedule and booking, token flow.
6. Notifications, disputes, invoices.
7. Testing with a few real wholesalers and retailers, then launch in Vashi.
