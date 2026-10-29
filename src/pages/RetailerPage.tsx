import { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Check,
  Filter,
  LayoutGrid,
  Package,
  Plus,
  Minus,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Table as TableIcon,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../catalog/useCatalog';
import { useCart } from '../cart/useCart';
import { categories } from '../data/masters';
import { formatCurrency } from '../lib/formatters';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import type { Product } from '../types';

export function RetailerPage() {
  const { products, wholesalers, loading, error } = useCatalog();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [grade, setGrade] = useState('');
  const [wholesaler, setWholesaler] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const visibleProducts = useMemo(() => {
    return products
      .filter((product) => {
        if (!product.isActive || product.stock < product.minOrder) return false;
        if (category && product.category !== category) return false;
        if (grade && product.grade !== grade) return false;
        if (wholesaler && product.wholesalerId !== wholesaler) return false;
        if (minPrice && product.price < Number(minPrice)) return false;
        if (maxPrice && product.price > Number(maxPrice)) return false;
        const query = search.trim().toLowerCase();
        return !query || `${product.name} ${product.category} ${product.wholesalerName}`.toLowerCase().includes(query);
      })
      .sort((left, right) => left.price - right.price);
  }, [products, category, grade, wholesaler, minPrice, maxPrice, search]);

  const comparisonGroups = useMemo(() => {
    const groups = new Map<string, Product[]>();
    for (const product of visibleProducts) {
      const key = `${product.category}:${product.name.trim().toLowerCase()}`;
      groups.set(key, [...(groups.get(key) ?? []), product]);
    }
    return [...groups.values()].filter((group) => group.length > 1);
  }, [visibleProducts]);

  const activeFilterCount = [category, grade, wholesaler, minPrice, maxPrice].filter(Boolean).length;

  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setGrade('');
    setWholesaler('');
    setMinPrice('');
    setMaxPrice('');
  };

  return (
    <main className="min-h-screen bg-slate-50 p-3 sm:p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Marketplace Banner */}
        <header className="mb-6 rounded-2xl md:rounded-3xl bg-slate-900 px-5 py-6 sm:px-8 sm:py-7 text-white shadow-card">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-800/80 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> APMC Vashi Mandi
                </span>
                <span className="text-xs text-slate-400">· Daily wholesale rates</span>
              </div>
              <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl md:text-4xl text-white tracking-tight">
                Wholesale Catalogue
              </h1>
              <p className="mt-1 max-w-xl text-xs sm:text-sm text-slate-300">
                Compare verified APMC mandi suppliers, quality grades, and bag rates. Minimum wholesale order quantities apply.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start rounded-xl bg-white/10 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-200 md:self-auto">
              <span className="font-extrabold text-emerald-400">{visibleProducts.length}</span> listings from{' '}
              <span className="font-extrabold text-emerald-400">{wholesalers.length}</span> verified stalls
            </div>
          </div>

          {/* Quick Search Bar */}
          <div className="mt-5 relative">
            <label htmlFor="catalogue-search" className="sr-only">Search catalogue</label>
            <div className="relative flex items-center">
              <Search size={18} className="pointer-events-none absolute left-4 text-slate-400" aria-hidden="true" />
              <input
                id="catalogue-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by grain, pulse, spice, or supplier shop name…"
                className="w-full min-h-[48px] rounded-xl border border-slate-700 bg-slate-800/90 pl-11 pr-10 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/30"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search query"
                  className="absolute right-3 p-1.5 text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              ) : (
                <kbd className="hidden sm:inline-block absolute right-3 rounded border border-slate-600 bg-slate-700/50 px-2 py-0.5 text-[11px] font-mono text-slate-400">
                  /
                </kbd>
              )}
            </div>
          </div>

          {/* Quick Category Chips (1-tap mobile filtering) */}
          <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar" role="tablist" aria-label="Quick categories">
            <button
              type="button"
              onClick={() => setCategory('')}
              className={`whitespace-nowrap min-h-[36px] rounded-lg px-3 py-1.5 font-bold transition ${category === ''
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(category === cat ? '' : cat)}
                className={`whitespace-nowrap min-h-[36px] rounded-lg px-3 py-1.5 font-bold transition ${category === cat
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </header>

        {/* View Controls & Action Bar */}
        <section className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              {compareMode ? 'Supplier Comparison' : 'Available Inventory'}
            </h2>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700">
              {visibleProducts.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Mobile Filter Button */}
            <Button
              variant="secondary"
              size="sm"
              className="lg:hidden"
              onClick={() => setMobileFilterOpen(true)}
            >
              <Filter size={15} className="mr-1.5" />
              Filters
              {activeFilterCount > 0 ? (
                <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-700 px-1 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>

            {/* View Mode Toggle (Grid vs Dense Table) */}
            {!compareMode ? (
              <div className="hidden sm:inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  aria-pressed={viewMode === 'grid'}
                  title="Grid view"
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition ${viewMode === 'grid' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  <LayoutGrid size={14} /> Cards
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  aria-pressed={viewMode === 'table'}
                  title="Dense table view"
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition ${viewMode === 'table' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  <TableIcon size={14} /> Table
                </button>
              </div>
            ) : null}

            {/* Compare Toggle */}
            <Button
              variant={compareMode ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setCompareMode((current) => !current)}
              aria-pressed={compareMode}
            >
              <ArrowDownUp size={15} className="mr-1.5" />
              {compareMode ? 'Show all listings' : 'Compare matching suppliers'}
            </Button>
          </div>
        </section>

        {/* Main Content Layout */}
        <div className="grid items-start gap-6 lg:grid-cols-[260px_1fr]">
          {/* Desktop Filter Sidebar */}
          <aside className="hidden lg:block rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sticky top-20">
            <div className="mb-4 flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <SlidersHorizontal size={16} /> Filters
              </h3>
              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
                >
                  Reset ({activeFilterCount})
                </button>
              ) : null}
            </div>

            <FilterForm
              category={category}
              setCategory={setCategory}
              grade={grade}
              setGrade={setGrade}
              wholesaler={wholesaler}
              setWholesaler={setWholesaler}
              wholesalers={wholesalers}
              minPrice={minPrice}
              setMinPrice={setMinPrice}
              maxPrice={maxPrice}
              setMaxPrice={setMaxPrice}
            />

          </aside>

          {/* Product Listings / Comparison */}
          <section aria-live="polite">
            {error ? (
              <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
                {error}
              </div>
            ) : null}

            {loading ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-700 border-t-transparent" />
                <p className="mt-3 text-sm font-semibold text-slate-700">Loading wholesale inventory…</p>
              </div>
            ) : null}

            {/* Compare Mode View */}
            {!loading && compareMode ? (
              comparisonGroups.length ? (
                <div className="space-y-4">
                  {comparisonGroups.map((group) => (
                    <CompareGroup key={`${group[0].category}:${group[0].name}`} products={group} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No multi-supplier matches found"
                  description="None of the products match multiple suppliers with the active filters. Clear a filter or turn off compare mode."
                  icon={<ArrowDownUp size={28} className="text-slate-400" />}
                  action={<Button variant="secondary" size="sm" onClick={clearFilters}>Reset filters</Button>}
                />
              )
            ) : null}

            {/* Standard Catalog (Grid or Dense Table) */}
            {!loading && !compareMode ? (
              visibleProducts.length ? (
                viewMode === 'grid' ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {visibleProducts.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                ) : (
                  <DenseTable products={visibleProducts} />
                )
              ) : (
                <EmptyState
                  title="No wholesale products match your search"
                  description="Try searching for another commodity, or clear filters to see all available APMC listings."
                  icon={<Search size={28} className="text-slate-400" />}
                  action={<Button variant="secondary" size="sm" onClick={clearFilters}>Reset filters</Button>}
                />
              )
            ) : null}
          </section>
        </div>
      </div>

      {/* Mobile Filter Bottom Drawer / Modal */}
      {mobileFilterOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-900/60 backdrop-blur-xs lg:hidden">
          <div className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-6 shadow-sheet">
            <div className="mb-4 flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="flex items-center gap-2 font-bold text-slate-900 text-base">
                <SlidersHorizontal size={18} /> Filters
              </h3>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X size={20} />
              </button>
            </div>

            <FilterForm
              category={category}
              setCategory={setCategory}
              grade={grade}
              setGrade={setGrade}
              wholesaler={wholesaler}
              setWholesaler={setWholesaler}
              wholesalers={wholesalers}
              minPrice={minPrice}
              setMinPrice={setMinPrice}
              maxPrice={maxPrice}
              setMaxPrice={setMaxPrice}
            />

            <div className="mt-6 flex items-center gap-3 pt-4 border-t border-slate-100">
              <Button
                variant="secondary"
                className="flex-1 min-h-[44px]"
                onClick={() => {
                  clearFilters();
                  setMobileFilterOpen(false);
                }}
              >
                Reset
              </Button>
              <Button
                variant="primary"
                className="flex-1 min-h-[44px]"
                onClick={() => setMobileFilterOpen(false)}
              >
                Apply ({visibleProducts.length} items)
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ProductCard({ product }: { product: Product }) {
  const { addToCart, setQuantity, items, loading } = useCart();
  const [imageFailed, setImageFailed] = useState(false);
  const [multiplier, setMultiplier] = useState(1);
  const [adding, setAdding] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);

  const calculatedQty = product.minOrder * multiplier;
  const inStock = product.stock >= product.minOrder;

  const addProduct = async () => {
    setAdding(true);
    setCartError(null);
    try {
      const existing = items.find((i) => i.product.id === product.id);
      if (existing) {
        await setQuantity(product, existing.quantity + calculatedQty);
      } else {
        await addToCart(product);
        if (calculatedQty > product.minOrder) {
          await setQuantity(product, calculatedQty);
        }
      }
    } catch (addError) {
      setCartError(addError instanceof Error ? addError.message : 'Unable to add this product.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition hover:border-slate-300 hover:shadow-hover">
      {/* Visual Header */}
      <div className="relative h-40 bg-slate-100 border-b border-slate-100 overflow-hidden">
        {product.image && !imageFailed ? (
          <img
            src={product.image}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-slate-100 text-slate-400">
            <Package size={36} aria-hidden="true" />
            <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {product.category}
            </span>
          </div>
        )}

        {/* Floating Badges */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Badge tone={inStock ? 'success' : 'danger'} dot>
            {inStock ? 'In stock' : 'Out of stock'}
          </Badge>
        </div>
        <div className="absolute right-3 top-3">
          <span className="inline-flex rounded-lg bg-slate-900/90 px-2 py-0.5 text-xs font-bold text-white shadow-xs">
            Grade {product.grade}
          </span>
        </div>
      </div>

      {/* Card Content */}
      <div className="flex flex-1 flex-col p-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            {product.category}
          </p>
          <h3 className="mt-0.5 text-base font-bold text-slate-900 leading-snug line-clamp-1" title={product.name}>
            {product.name}
          </h3>
          <Link
            to={`/wholesalers/${product.wholesalerId}`}
            className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-700 transition"
          >
            <Store size={13} className="shrink-0 text-slate-400" />
            <span className="truncate">{product.wholesalerName}</span>
          </Link>
        </div>

        {/* Pricing & Units */}
        <div className="mt-3.5 rounded-xl bg-slate-50 p-2.5 border border-slate-100">
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-slate-900 font-mono">
              {formatCurrency(product.price)}
            </span>
            <span className="text-xs font-bold text-slate-700">
              per {product.unit}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-600 border-t border-slate-200/60 pt-1">
            <span>MOQ: <strong className="text-slate-800">{product.minOrder} {product.unit}</strong></span>
            <span>Stock: <strong className="text-slate-800">{product.stock} {product.unit}</strong></span>
          </div>
        </div>

        {cartError ? (
          <p role="alert" className="mt-2 text-xs font-semibold text-red-700">
            {cartError}
          </p>
        ) : null}

        {/* Action Controls */}
        <div className="mt-4 pt-2 border-t border-slate-100 flex items-center gap-2">
          {/* Quick Stepper for multipliers */}
          <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white shadow-2xs">
            <button
              type="button"
              disabled={multiplier <= 1}
              onClick={() => setMultiplier((m) => Math.max(1, m - 1))}
              className="flex h-9 w-9 items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent min-h-[36px]"
              aria-label="Decrease quantity"
            >
              <Minus size={14} />
            </button>
            <span className="px-2 text-xs font-bold font-mono text-slate-900 min-w-[28px] text-center">
              {multiplier}x
            </span>
            <button
              type="button"
              disabled={calculatedQty + product.minOrder > product.stock}
              onClick={() => setMultiplier((m) => m + 1)}
              className="flex h-9 w-9 items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent min-h-[36px]"
              aria-label="Increase quantity"
            >
              <Plus size={14} />
            </button>
          </div>

          <Button
            className="flex-1 min-h-[40px] text-xs font-bold"
            disabled={adding || loading || !inStock}
            onClick={() => void addProduct()}
          >
            <ShoppingCart size={14} className="mr-1.5" />
            {adding ? 'Adding…' : `Add ${calculatedQty} ${product.unit}`}
          </Button>
        </div>
      </div>
    </article>
  );
}

function DenseTable({ products }: { products: Product[] }) {
  const { addToCart, loading } = useCart();
  const [addingId, setAddingId] = useState<string | null>(null);

  const add = async (product: Product) => {
    setAddingId(product.id);
    try {
      await addToCart(product, product.minOrder);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
              <th className="px-4 py-3">Commodity</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-3 py-3 text-center">Grade</th>
              <th className="px-4 py-3 text-right">Wholesale Rate</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3 text-right">MOQ</th>
              <th className="px-4 py-3 text-right">Order Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
            {products.map((product) => {
              const inStock = product.stock >= product.minOrder;
              return (
                <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-900">{product.name}</p>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/wholesalers/${product.wholesalerId}`}
                      className="text-xs font-semibold text-slate-700 hover:text-emerald-700 transition"
                    >
                      {product.wholesalerName}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-800">
                      Grade {product.grade}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                    {formatCurrency(product.price)}{' '}
                    <span className="text-xs font-normal text-slate-500">/{product.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs">
                    <span className={inStock ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>
                      {product.stock} {product.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-slate-700 font-semibold">
                    {product.minOrder} {product.unit}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      disabled={addingId === product.id || loading || !inStock}
                      onClick={() => void add(product)}
                      className="min-h-[36px] text-xs"
                    >
                      <ShoppingCart size={13} className="mr-1" />
                      {addingId === product.id ? 'Adding…' : `+${product.minOrder} ${product.unit}`}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompareGroup({ products: group }: { products: Product[] }) {
  const lowestPrice = Math.min(...group.map((p) => p.price));

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
        <div>
          <h3 className="font-extrabold text-slate-900 text-base">{group[0].name}</h3>
          <p className="text-xs font-semibold text-slate-600">
            {group[0].category} · <span className="font-bold text-emerald-800">{group.length} suppliers offering this staple</span>
          </p>
        </div>
        <Badge tone="info">Live Rate Comparison</Badge>
      </div>

      <div className="divide-y divide-slate-100">
        {group.map((product) => {
          const isBestPrice = product.price === lowestPrice;
          return (
            <div
              key={product.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 transition ${isBestPrice ? 'bg-emerald-50/40' : 'hover:bg-slate-50'
                }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    to={`/wholesalers/${product.wholesalerId}`}
                    className="font-bold text-slate-900 hover:text-emerald-700 hover:underline text-sm"
                  >
                    {product.wholesalerName}
                  </Link>
                  {isBestPrice ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-900">
                      <Check size={12} /> Best Rate
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span>Grade: <strong className="text-slate-800">{product.grade}</strong></span>
                  <span>Stock: <strong className="text-slate-800">{product.stock} {product.unit}</strong></span>
                  <span>Min Order: <strong className="text-slate-800">{product.minOrder} {product.unit}</strong></span>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-0 border-slate-100 pt-2 sm:pt-0">
                <div className="text-left sm:text-right">
                  <p className="text-lg font-extrabold text-slate-900 font-mono">
                    {formatCurrency(product.price)}
                  </p>
                  <p className="text-xs text-slate-500">per {product.unit}</p>
                </div>
                <CompareAddButton product={product} />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function CompareAddButton({ product }: { product: Product }) {
  const { addToCart, loading } = useCart();
  const [adding, setAdding] = useState(false);

  const add = async () => {
    setAdding(true);
    try {
      await addToCart(product, product.minOrder);
    } finally {
      setAdding(false);
    }
  };

  return (
    <Button
      size="sm"
      disabled={adding || loading}
      onClick={() => void add()}
      className="min-h-[40px] text-xs font-bold"
    >
      <ShoppingCart size={14} className="mr-1.5" />
      {adding ? 'Adding…' : `Add ${product.minOrder} ${product.unit}`}
    </Button>
  );
}

function FilterForm({
  category,
  setCategory,
  grade,
  setGrade,
  wholesaler,
  setWholesaler,
  wholesalers,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
}: {
  category: string;
  setCategory: (val: string) => void;
  grade: string;
  setGrade: (val: string) => void;
  wholesaler: string;
  setWholesaler: (val: string) => void;
  wholesalers: { id: string; name: string }[];
  minPrice: string;
  setMinPrice: (val: string) => void;
  maxPrice: string;
  setMaxPrice: (val: string) => void;
}) {
  return (
    <div className="space-y-4">
      <FilterSelect
        label="Category"
        value={category}
        onChange={setCategory}
        options={categories}
        placeholder="All Commodities"
      />
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">Quality Grade</span>
        <input
          type="text"
          value={grade}
          onChange={(event) => setGrade(event.target.value)}
          placeholder="All Grades"
          className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
        />
      </label>
      <FilterSelect
        label="Supplier Stall"
        value={wholesaler}
        onChange={setWholesaler}
        options={wholesalers.map((seller) => ({ value: seller.id, label: seller.name }))}
        placeholder="All Wholesalers"
      />

      <fieldset>
        <legend className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">Price per unit (₹)</legend>
        <div className="grid grid-cols-2 gap-2">
          <input
            aria-label="Minimum price in Rupees"
            type="number"
            min="0"
            placeholder="Min ₹"
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value)}
            className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          />
          <input
            aria-label="Maximum price in Rupees"
            type="number"
            min="0"
            placeholder="Max ₹"
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
            className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          />
        </div>
      </fieldset>
    </div>
  );
}

function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (T | { value: string; label: string })[];
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => {
          const item = typeof option === 'string' ? { value: option, label: option } : option;
          return (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}
