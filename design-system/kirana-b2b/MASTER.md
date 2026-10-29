# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/kirana-b2b/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Kirana B2B Marketplace (Vashi Wholesale)
**Generated:** 2026-10-29 12:45:00
**Category:** B2B Wholesale / Indian Kirana Commerce
**Target Users:** Kirana store owners ordering wholesale staples & mandi goods, APMC wholesalers, marketplace operations team
**Design Dials:** Variance 4/10 (Balanced / Structured) | Motion 3/10 (Subtle / Instant) | Density 7/10 (Dense / Dashboard)

---

## Global Rules

### 1. Color Palette (High-Contrast Shop-Floor Optimized)
Engineered for intense sunlight, bright fluorescent retail lighting, and rapid scanning. All body and numerical text strictly meets or exceeds WCAG AA (>= 4.5:1) and AAA (>= 7:1) contrast against its surface.

| Role | Hex | Tailwind Token / CSS Variable | Usage & Contrast Ratio |
|------|-----|-------------------------------|-------------------------|
| Primary Brand | `#15803D` | `brand-700` / `--color-primary` | Main actions, primary brand headers, badge accents (Contrast 5.4:1 on white) |
| Primary Dark (Deep Forest) | `#14532D` | `brand-900` / `--color-primary-dark` | Hero backgrounds, high-contrast headings, active states (Contrast 11.6:1 on white) |
| Primary Light (Tint) | `#DCFCE7` | `brand-100` / `--color-primary-light` | Soft pill backgrounds, selected row highlights |
| Primary Subdued | `#F0FDF4` | `brand-50` / `--color-primary-subdued` | Active nav link background, subtle callout cards |
| Secondary Brand (Slate Navy) | `#0F172A` | `slate-900` / `--color-secondary` | Primary text, high-emphasis metrics, dark desktop sidebars |
| Accent / CTA (Warm Saffron/Amber) | `#B45309` | `accent-700` / `--color-accent` | Urgent CTAs, promo badges, pending verification (Contrast 5.1:1 on white) |
| Accent Light | `#FEF3C7` | `accent-100` / `--color-accent-light` | Pending tags, warning callout container |
| Background Canvas | `#F8FAFC` | `slate-50` / `--color-background` | App surface, neutral backing |
| Card / Surface | `#FFFFFF` | `white` / `--color-card` | Container surface, elevated panels, modal backgrounds |
| Foreground / Text Primary | `#0F172A` | `slate-900` / `--color-foreground` | Headings, prices, quantities (Contrast 18.2:1 on white) |
| Foreground Muted / Text Secondary | `#334155` | `slate-700` / `--color-muted-foreground` | Secondary labels, units, wholesaler shop numbers (Contrast 8.9:1 on white) |
| Subtle Text / Captions | `#475569` | `slate-600` / `--color-subtle-foreground` | Timestamps, secondary helper text (Contrast 5.7:1 on white - never drop below slate-600) |
| Border Strong | `#CBD5E1` | `slate-300` / `--color-border-strong` | Form field borders, interactive button borders, card borders |
| Border Subdued | `#E2E8F0` | `slate-200` / `--color-border` | Table row dividers, inner card dividers |
| Success (Settled / In Stock) | `#16A34A` | `emerald-600` / `--color-success` | Stock badges, delivered orders, verified KYC |
| Warning (Pending / Escrow) | `#D97706` | `amber-600` / `--color-warning` | Reserved stock, pending dispatch, cash-on-delivery |
| Destructive (Dispute / Cancelled) | `#DC2626` | `red-600` / `--color-destructive` | Out of stock alerts, dispute claims, remove actions |
| Focus Ring | `#16A34A` | `brand-600` / `--color-ring` | High-visibility 2px/3px outline with 2px offset |

**Color Notes:**
- Avoid `text-slate-400` or `text-slate-500` for critical data (units, rates, order totals) because Indian kirana owners frequently place orders on budget phone screens outdoors or under harsh counter lighting. The minimum text color is `text-slate-600` (contrast > 5.5:1).
- Green represents fresh agricultural stock, successful orders, and commercial trust; warm amber signals action items (collection, pending payout, transport cutoff).

---

### 2. Typography
- **Heading Font:** `Plus Jakarta Sans`, system-ui, sans-serif
- **Body Font:** `Plus Jakarta Sans`, system-ui, sans-serif
- **Data & Numeric Font:** `Plus Jakarta Sans` with `tabular-nums` (or `JetBrains Mono` for pickup tokens, order IDs, and GSTIN numbers)
- **Mood:** Professional, clear, authoritative, highly legible on small screens

**Google Fonts URL:**
`https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap`

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');
```

**Type Scale:**
- `Display / Hero`: `2rem` (32px) on mobile -> `2.5rem` (40px) on desktop, Bold 800, leading tight
- `H1 / Page Title`: `1.5rem` (24px) on mobile -> `1.875rem` (30px) on desktop, Bold 700
- `H2 / Section Title`: `1.25rem` (20px), Bold 700
- `H3 / Card Title`: `1rem` (16px), SemiBold 600
- `Body / Standard`: `0.875rem` (14px), Regular 400 / Medium 500, line-height 1.5
- `Price Callout`: `1.25rem` (20px) to `1.5rem` (24px), ExtraBold 800, `font-mono tabular-nums`
- `Units & Quantities`: `0.875rem` (14px), SemiBold 600 (never smaller than 12px)
- `Meta / Badges`: `0.75rem` (12px), SemiBold 600, uppercase letterSpacing 0.05em

---

### 3. Spacing Scale & Layout Rhythm
*Density: 7/10 — Dense / Wholesale Commerce (Clean, compact, no wasted screen real estate)*

| Token | Pixels | Rem | Kirana App Usage |
|-------|--------|-----|-------------------|
| `--space-xs` | `4px` | `0.25rem` | Badge padding, quantity stepper spacing |
| `--space-sm` | `8px` | `0.5rem` | Icon gaps, compact table padding, tag margins |
| `--space-md` | `12px` | `0.75rem` | Input internal padding, card inner spacing |
| `--space-lg` | `16px` | `1rem` | Standard mobile card padding, grid gaps |
| `--space-xl` | `24px` | `1.5rem` | Section gutters, desktop card padding |
| `--space-2xl` | `32px` | `2rem` | Page header padding, modal internal spacing |
| `--space-3xl` | `48px` | `3rem` | Large display headers, desktop page top margin |

---

### 4. Responsive Layout Strategy (Breakpoints: 375px, 768px, 1024px, 1440px)

| Breakpoint | Target Device | Navigation Pattern | Catalog Layout | Orders / Data View | Cart & Checkout |
|------------|---------------|--------------------|----------------|--------------------|-----------------|
| **375px** (Mobile) | Budget Android smartphones | Sticky compact top bar + bottom tab bar (Marketplace, Orders, Cart, Profile) | 1-column card list; quick category chip carousel; sticky bottom filter toggle button | Stacked card list with swipe/tap details and prominent pickup tokens | Sticky single-tap checkout bar at viewport bottom; large numeric steppers (+ / -) |
| **768px** (Tablet) | Countertop tablets & POS | Top navigation with icon badges | 2-column responsive grid; collapsible filter bar | 2-column order cards with expandable items | Split view: items on left, sticky order summary on right |
| **1024px** (Laptop) | Wholesaler shop office / laptop | Collapsible sidebar or persistent top nav with breadcrumbs | 3-column grid or dense tabular toggle; persistent 260px filter sidebar | Full data table with inline status filters and export | 2-column layout (`1fr 380px`) with persistent summary panel |
| **1440px** (Desktop) | Large warehouse & distributor desktop monitors | Expanded multi-tier dashboard header with quick stats | 4-column wide grid; fast multi-SKU bulk entry mode | Dense enterprise data table with sortable columns and batch actions | Side-by-side catalog comparison & order dispatch staging |

---

## Component Specs

### 1. Buttons & Steppers
- All buttons must have `min-height: 44px` on mobile for fat-finger touch accessibility on shop floors.
- Hover states must not shift layout bounds.
- Keyboard focus visible with `focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-600`.

```css
/* Primary Action Button */
.btn-primary {
  background-color: #15803d; /* brand-700 */
  color: #ffffff;
  min-height: 44px;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color 150ms ease, transform 100ms ease;
  cursor: pointer;
}
.btn-primary:hover {
  background-color: #14532d; /* brand-900 */
}
.btn-primary:active {
  transform: scale(0.98);
}

/* Secondary Button */
.btn-secondary {
  background-color: #ffffff;
  color: #0f172a;
  border: 1px solid #cbd5e1; /* slate-300 */
  min-height: 44px;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
.btn-secondary:hover {
  background-color: #f8fafc;
  border-color: #94a3b8;
}

/* Touch Quantity Stepper (for Kirana speed ordering) */
.stepper-container {
  display: inline-flex;
  align-items: center;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
}
.stepper-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  color: #0f172a;
  font-weight: 700;
}
.stepper-input {
  width: 60px;
  height: 44px;
  text-align: center;
  font-weight: 700;
  font-family: inherit;
  border: none;
}
```

### 2. Product & Listing Card
- Must clearly separate: Product Name, Wholesaler Name (with link), Grade Tag, Stock Availability, Price, and Minimum Order Quantity (MOQ).
- Price and unit must NEVER be ambiguous: e.g. `₹2,450 / 25kg bag` with rate breakdown `(₹98/kg)`.
- Replaces emoji fallbacks with SVG icons (`Package`, `Wheat`, `Box`, `ShoppingBag`).

### 3. Orders & Tracking Card
- Prominent Pickup Token display: large, monospace, high contrast badge (`e.g. #VT-8492`) for quick showing to truck drivers or mandi stall counters.
- Multi-wholesaler group breakdown clearly indicating shop numbers (e.g. `Shop B-42, APMC Market 2, Vashi`).
- One-click "Reorder Items" action button.

### 4. Input Fields & Search
- Search bar with clear button and keyboard shortcut hint (`/` or `Ctrl+K`).
- Clear visual labels and hint text.
- Form inputs have 44px minimum height and clear error message states (`role="alert"`).

---

## Anti-Patterns (Forbidden)
- ❌ **No emojis as UI icons or placeholders** (No 🌾, 📦, 🚚 as emojis; use Lucide/Phosphor SVG vector icons).
- ❌ **No low-contrast gray text** (`text-slate-400` or `#94a3b8` for copy; minimum is `slate-600` for 4.5:1+ contrast).
- ❌ **No tiny tap targets** (< 44px on mobile buttons or quantity controls).
- ❌ **No hidden prices or ambiguous units** (Always show `₹ [amount] / [unit]`, MOQ clearly highlighted).
- ❌ **No layout-shifting hover scales** (`hover:scale-105` or transforms that trigger horizontal scroll).
- ❌ **No flashing gradients or glassmorphism blur** that hinders readability under Indian sun/shop lights.
- ❌ **No horizontal scrolling of critical forms or tables** without sticky labels or card view fallback.

---

## Pre-Delivery Checklist
- [ ] Tested and responsive at **375px** (Mobile), **768px** (Tablet), **1024px** (Laptop), and **1440px** (Desktop).
- [ ] Touch targets >= 44x44px across all buttons, inputs, and navigation links.
- [ ] No emojis used anywhere as structural icons or product image fallbacks.
- [ ] All text contrast >= 4.5:1 against its background.
- [ ] Keyboard navigation fully supported (`focus-visible` ring on all interactive elements).
- [ ] `prefers-reduced-motion` respected (no disorienting animations).
- [ ] Fast repeat ordering and clear MOQ enforcement.
