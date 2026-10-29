import { ArrowLeft, CheckCircle2, MapPin, Package, Phone, ShoppingCart, Store } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCatalog } from '../catalog/useCatalog';
import { useCart } from '../cart/useCart';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { formatCurrency } from '../lib/formatters';
import type { Product } from '../types';

export function WholesalerProfilePage() {
  const { wholesalerId } = useParams();
  const { products, wholesalers, loading, error } = useCatalog();
  const wholesaler = wholesalers.find((seller) => seller.id === wholesalerId);
  const listings = products.filter(
    (product) => product.wholesalerId === wholesalerId && product.isActive && product.stock > 0,
  );

  if (!loading && !wholesaler) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 sm:p-6 md:p-8">
        <div className="mx-auto max-w-3xl">
          <Link to="/retailer" className="mb-4 inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-emerald-700 min-h-[40px]">
            <ArrowLeft size={16} /> Back to wholesale catalogue
          </Link>
          <EmptyState
            title="Wholesaler stall not found"
            description="This APMC wholesale profile is no longer available or may have moved."
            icon={<Store size={32} className="text-slate-400" />}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-3 sm:p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/retailer"
          className="mb-4 inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-emerald-700 hover:text-emerald-900 min-h-[40px] transition"
        >
          <ArrowLeft size={16} /> Back to wholesale catalogue
        </Link>

        {error ? (
          <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm font-semibold text-red-800">
            {error}
          </div>
        ) : null}

        {loading || !wholesaler ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-xs">
            <div className="mx-auto h-7 w-7 animate-spin rounded-full border-3 border-emerald-700 border-t-transparent" />
            <p className="mt-3 text-sm font-semibold text-slate-700">Loading verified stall details…</p>
          </div>
        ) : (
          <>
            {/* Wholesaler Header Card */}
            <header className="mb-6 rounded-3xl bg-slate-900 p-6 text-white shadow-card sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-800 text-emerald-200 font-extrabold text-2xl shadow-xs">
                  <Store size={32} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-800/80 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-emerald-200">
                      <CheckCircle2 size={13} className="text-emerald-400" /> APMC Verified Stall
                    </span>
                    <span className="text-xs text-slate-400">· Vashi Mandi</span>
                  </div>
                  <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {wholesaler.name}
                  </h1>
                  <p className="mt-1 flex items-center gap-1.5 text-xs sm:text-sm text-slate-300">
                    <MapPin size={15} className="shrink-0 text-emerald-400" /> {wholesaler.address}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs sm:text-sm text-slate-300">
                    <Package size={15} className="shrink-0 text-emerald-400" /> Stall #{wholesaler.shopNumber}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 border-t border-slate-800 pt-5 sm:grid-cols-3">
                <ProfileDetail label="Stall Manager" value={wholesaler.contactName} />
                <ProfileDetail label="Mandi Shop Number" value={`Stall ${wholesaler.shopNumber}`} />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Direct Phone</p>
                  <a
                    href={`tel:${wholesaler.contactPhone}`}
                    className="mt-1 inline-flex items-center gap-1.5 font-bold text-white hover:text-emerald-400 transition"
                  >
                    <Phone size={14} className="text-emerald-400" /> {wholesaler.contactPhone}
                  </a>
                </div>
              </div>
            </header>

            {/* Inventory Section */}
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">Available Commodity Listings</h2>
                <p className="text-xs text-slate-600">Current in-stock inventory ready for APMC pickup or dispatch.</p>
              </div>
              <Badge tone="info">{listings.length} Active Listings</Badge>
            </div>

            {listings.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {listings.map((product) => (
                  <WholesalerListingCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No active products in stock"
                description="This wholesaler currently has no available stock published in the catalogue."
                icon={<Package size={32} className="text-slate-400" />}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}

function WholesalerListingCard({ product }: { product: Product }) {
  const { addToCart, loading } = useCart();
  const [adding, setAdding] = useState(false);

  const add = async () => {
    setAdding(true);
    try {
      await addToCart(product);
    } finally {
      setAdding(false);
    }
  };

  return (
    <article className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-slate-300 hover:shadow-hover">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">{product.category}</p>
            <h3 className="mt-0.5 text-base font-bold text-slate-900">{product.name}</h3>
          </div>
          <Badge>Grade {product.grade}</Badge>
        </div>

        <div className="mt-3 rounded-xl bg-slate-50 p-2.5 border border-slate-100">
          <p className="text-xl font-extrabold text-slate-900 font-mono">
            {formatCurrency(product.price)}{' '}
            <span className="text-xs font-semibold text-slate-600">/ {product.unit}</span>
          </p>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-600 border-t border-slate-200/60 pt-1">
            <span>Stock: <strong className="text-slate-800">{product.stock} {product.unit}</strong></span>
            <span>MOQ: <strong className="text-slate-800">{product.minOrder} {product.unit}</strong></span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-2 border-t border-slate-100">
        <Button
          size="sm"
          className="w-full min-h-[40px] text-xs font-bold"
          disabled={adding || loading || product.stock < product.minOrder}
          onClick={() => void add()}
        >
          <ShoppingCart size={14} className="mr-1.5" />
          {adding ? 'Adding…' : `Add ${product.minOrder} ${product.unit}`}
        </Button>
      </div>
    </article>
  );
}

function ProfileDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 font-bold text-white text-sm truncate">{value}</p>
    </div>
  );
}
