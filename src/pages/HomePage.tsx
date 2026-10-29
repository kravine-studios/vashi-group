import type { ReactNode } from 'react';
import { ArrowRight, Box, CheckCircle2, ShoppingCart, ShieldCheck, Store, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white font-black text-base shadow-xs">
              V
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">APMC Wholesale Network</p>
              <h1 className="text-lg font-extrabold text-slate-900 leading-none">Vashi B2B Market</h1>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-700 md:flex">
            <Link to="/retailer" className="hover:text-emerald-700 transition">Retailer Catalogue</Link>
            <Link to="/wholesaler" className="hover:text-emerald-700 transition">Wholesaler Portal</Link>
            <Link to="/admin" className="hover:text-emerald-700 transition">Marketplace Admin</Link>
          </nav>

          <div className="flex items-center gap-2.5">
            <Link
              to="/register"
              className="hidden sm:inline-flex items-center justify-center min-h-[40px] px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              Register Shop
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center min-h-[40px] px-4 py-2 rounded-xl text-sm font-bold bg-emerald-700 text-white hover:bg-emerald-900 shadow-xs transition active:scale-[0.98]"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-12">
        {/* Hero Section */}
        <section className="grid items-center gap-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-card lg:grid-cols-12 lg:p-10">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">
              <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
              Verified APMC Mandi Wholesale
            </div>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl md:text-5xl leading-tight">
              Direct wholesale buying for Indian kirana stores.
            </h2>
            <p className="mt-4 max-w-2xl text-base sm:text-lg text-slate-700 leading-relaxed">
              Order grains, pulses, spices and cooking oil directly from verified Vashi APMC wholesalers. Combine items from multiple suppliers into one single cart with guaranteed pickup slots.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/retailer"
                className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-900 shadow-sm transition active:scale-[0.98]"
              >
                Browse wholesale catalogue <ArrowRight size={17} />
              </Link>
              <Link
                to="/login"
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50 transition active:scale-[0.98]"
              >
                Wholesaler portal
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-100 pt-6 text-xs sm:text-sm font-medium text-slate-600">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-emerald-600" /> GSTIN & FSSAI verified</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-emerald-600" /> Cash on delivery available</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-emerald-600" /> Daily transport slots</span>
            </div>
          </div>

          {/* Quick Metrics & Key Pillars */}
          <div className="grid gap-4 lg:col-span-5">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Today's APMC Volume</p>
                  <p className="mt-1 text-3xl font-extrabold text-slate-900 font-mono">₹4,85,000</p>
                  <p className="mt-0.5 text-xs text-slate-600">128 kirana baskets settled</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-xs">
                  <ShoppingCart size={22} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FeatureCard icon={<Box size={20} className="text-emerald-700" />} title="40+ Staples" description="Rice, pulses, spices & oils" />
              <FeatureCard icon={<Truck size={20} className="text-emerald-700" />} title="Daily Transport" description="Scheduled mandi truck slots" />
              <FeatureCard icon={<ShieldCheck size={20} className="text-emerald-700" />} title="KYC Verified" description="Direct supplier shop numbers" />
              <FeatureCard icon={<Store size={20} className="text-emerald-700" />} title="Single Basket" description="Multi-wholesaler checkout" />
            </div>
          </div>
        </section>

        {/* Wholesale Value Chain Banner */}
        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Step 1</span>
            <h3 className="mt-1 text-base font-bold text-slate-900">Compare wholesale rates</h3>
            <p className="mt-1 text-sm text-slate-600">Check current mandi rates per kg or 25kg bag from multiple APMC stalls side-by-side.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Step 2</span>
            <h3 className="mt-1 text-base font-bold text-slate-900">One combined basket</h3>
            <p className="mt-1 text-sm text-slate-600">Add minimum orders from different suppliers into one combined retailer order.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Step 3</span>
            <h3 className="mt-1 text-base font-bold text-slate-900">Fast token pickup</h3>
            <p className="mt-1 text-sm text-slate-600">Show your secure pickup token at each stall or book a shared delivery truck slot.</p>
          </div>
        </section>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="mb-2 inline-flex rounded-lg bg-slate-100 p-2">{icon}</div>
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <p className="mt-0.5 text-xs text-slate-600">{description}</p>
    </div>
  );
}
