import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
  Warehouse,
} from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { useCatalog } from '../catalog/useCatalog';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { ProductEditorModal } from '../components/ProductEditorModal';
import { IncomingOrderModal } from '../components/IncomingOrderModal';
import { supabase } from '../lib/env';
import { formatCurrency } from '../lib/formatters';
import {
  listDemoSellerOrders,
  verifyDemoPickupToken,
  type IncomingSubOrder,
  type OrderLine,
  type PickupVerification,
} from '../services/demoOrders';
import type { Product } from '../types';

export function WholesalerPage() {
  const { account } = useAuth();
  const { products, loading, error, deleteProduct, toggleProductActive } = useCatalog();
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyProduct, setBusyProduct] = useState<string | null>(null);
  const [incomingOrders, setIncomingOrders] = useState<IncomingSubOrder[]>([]);
  const [incomingLoading, setIncomingLoading] = useState(true);
  const [incomingError, setIncomingError] = useState<string | null>(null);
  const [pickupToken, setPickupToken] = useState('');
  const [verification, setVerification] = useState<PickupVerification | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [selectedIncoming, setSelectedIncoming] = useState<IncomingSubOrder | null>(null);

  const ownProducts = useMemo(
    () => products.filter((product) => product.wholesalerId === account?.id),
    [products, account?.id],
  );
  const activeProducts = ownProducts.filter((product) => product.isActive && product.stock > 0).length;
  const stockValue = ownProducts.reduce((total, product) => total + product.price * product.stock, 0);

  const loadIncomingOrders = useCallback(async () => {
    if (!account || account.role !== 'wholesaler' || account.status !== 'approved' || !account.profileCompleted) {
      setIncomingOrders([]);
      setIncomingLoading(false);
      return;
    }
    setIncomingLoading(true);
    setIncomingError(null);
    try {
      if (!supabase) {
        setIncomingOrders(listDemoSellerOrders(account.id, products));
        return;
      }
      const { data: rows, error: orderError } = await supabase
        .from('wholesaler_order_details')
        .select('*')
        .eq('wholesaler_id', account.id)
        .order('order_created_at', { ascending: false })
        .limit(100);
      if (orderError) throw orderError;
      const subOrderIds = rows.map((row) => row.sub_order_id);
      const { data: itemRows, error: itemsError } = subOrderIds.length
        ? await supabase
            .from('sub_order_items')
            .select('sub_order_id, product_id, product_name, category, grade, unit, unit_price, quantity, line_total')
            .in('sub_order_id', subOrderIds)
        : { data: [], error: null };
      if (itemsError) throw itemsError;
      const itemsBySubOrder = new Map<string, OrderLine[]>();
      for (const item of itemRows) {
        const orderLines = itemsBySubOrder.get(item.sub_order_id) ?? [];
        orderLines.push({
          productId: item.product_id ?? '',
          name: item.product_name,
          category: item.category,
          grade: item.grade,
          unit: item.unit,
          unitPrice: Number(item.unit_price),
          quantity: Number(item.quantity),
          lineTotal: Number(item.line_total),
        });
        itemsBySubOrder.set(item.sub_order_id, orderLines);
      }
      setIncomingOrders(
        rows.map((row) => ({
          orderId: row.order_id,
          orderCreatedAt: row.order_created_at,
          orderStatus: row.order_status,
          paymentMethod: row.payment_method,
          paymentStatus: row.payment_status,
          fulfilmentMethod: row.fulfilment_method,
          pickupToken: null,
          subtotal: Number(row.subtotal),
          retailer: {
            businessName: row.retailer_business_name ?? 'Retailer',
            shopNumber: row.retailer_shop_number ?? 'Shop details unavailable',
            contactName: row.retailer_contact_name ?? 'Contact unavailable',
            contactPhone: row.retailer_contact_phone ?? '',
          },
          transport:
            row.transport_slot_id &&
            row.transport_starts_at &&
            row.transport_ends_at &&
            row.transport_driver_name &&
            row.transport_contact_number
              ? {
                  id: row.transport_slot_id,
                  startsAt: row.transport_starts_at,
                  endsAt: row.transport_ends_at,
                  driverName: row.transport_driver_name,
                  contactNumber: row.transport_contact_number,
                }
              : null,
          subOrder: {
            id: row.sub_order_id,
            wholesalerId: row.wholesaler_id,
            wholesalerName: account.businessName,
            status: row.sub_order_status,
            amount: Number(row.amount),
            wholesalerShopNumber: account.shopNumber,
            wholesalerContactName: account.contactName,
            wholesalerContactPhone: account.contactPhone,
            items: itemsBySubOrder.get(row.sub_order_id) ?? [],
          },
        })),
      );
    } catch (loadError) {
      setIncomingError(loadError instanceof Error ? loadError.message : 'Unable to load incoming orders.');
    } finally {
      setIncomingLoading(false);
    }
  }, [account, products]);

  useEffect(() => {
    void loadIncomingOrders();
  }, [loadIncomingOrders]);

  const editProduct = (product: Product) => {
    setSelectedProduct(product);
    setEditorOpen(true);
  };

  const addProduct = () => {
    setSelectedProduct(null);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setSelectedProduct(null);
  };

  const runProductAction = async (product: Product, action: () => Promise<void>) => {
    setActionError(null);
    setBusyProduct(product.id);
    try {
      await action();
    } catch (productError) {
      setActionError(productError instanceof Error ? productError.message : 'Unable to update product.');
    } finally {
      setBusyProduct(null);
    }
  };

  const removeProduct = (product: Product) => {
    if (!window.confirm(`Remove "${product.name}" from your catalogue?`)) return;
    void runProductAction(product, () => deleteProduct(product));
  };

  const verifyPickup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!account || !pickupToken.trim()) return;
    setVerification(null);
    setVerificationError(null);
    setVerifying(true);
    try {
      if (!supabase) {
        setVerification(verifyDemoPickupToken(account.id, pickupToken, products));
      } else {
        const { data, error: tokenError } = await supabase.rpc('verify_pickup_token', {
          token_input: pickupToken.trim(),
        });
        if (tokenError) throw tokenError;
        const match = data[0];
        if (!match) throw new Error('No active self-pickup order with that token is assigned to your shop.');
        setVerification({
          orderId: match.order_id,
          subOrderId: match.sub_order_id,
          retailer: {
            businessName: match.retailer_business_name ?? 'Retailer',
            shopNumber: match.retailer_shop_number ?? 'Shop details unavailable',
            contactName: match.retailer_contact_name ?? 'Contact unavailable',
            contactPhone: match.retailer_contact_phone ?? '',
          },
          amount: Number(match.amount),
          paymentMethod: match.payment_method,
          paymentStatus: match.payment_status,
          orderStatus: match.order_status,
          subOrderStatus: match.sub_order_status,
        });
      }
    } catch (tokenError) {
      setVerificationError(tokenError instanceof Error ? tokenError.message : 'Unable to verify this pickup token.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-3 sm:p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Wholesaler Header */}
        <header className="mb-6 rounded-3xl bg-slate-900 p-6 text-white shadow-card sm:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-800/80 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-emerald-200">
                  <Warehouse size={13} className="text-emerald-400" /> APMC Wholesaler Portal
                </span>
                <span className="text-xs text-slate-400">· Stall #{account?.shopNumber ?? '—'}</span>
              </div>
              <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {account?.businessName ?? 'Wholesaler Dashboard'}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-300">
                Manage stock availability, rates per bag/kg, and verify retailer pickup tokens.
              </p>
            </div>
            <Button onClick={addProduct} size="md" className="self-start md:self-auto min-h-[44px]">
              <Plus size={17} className="mr-1.5" /> Publish New Commodity
            </Button>
          </div>
        </header>

        {/* Operational Metrics */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Active Listings"
            value={String(ownProducts.length)}
            icon={<Warehouse size={20} className="text-blue-700" />}
            bg="bg-blue-50 border-blue-200"
          />
          <StatCard
            label="In Stock Now"
            value={String(activeProducts)}
            icon={<CheckCircle2 size={20} className="text-emerald-700" />}
            bg="bg-emerald-50 border-emerald-200"
          />
          <StatCard
            label="Incoming Orders"
            value={String(incomingOrders.length)}
            icon={<PackageCheck size={20} className="text-purple-700" />}
            bg="bg-purple-50 border-purple-200"
          />
          <StatCard
            label="Total Inventory Value"
            value={formatCurrency(stockValue)}
            icon={<Wallet size={20} className="text-amber-700" />}
            bg="bg-amber-50 border-amber-200"
            isMonospace
          />
        </div>

        {error || actionError ? (
          <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm font-semibold text-red-800">
            {actionError ?? error}
          </div>
        ) : null}

        {/* Product Inventory Table */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs md:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Catalogue Inventory</h2>
              <p className="text-xs text-slate-600">Update rates, minimum order quantities and stock levels.</p>
            </div>
            <Badge tone="info">{ownProducts.length} published staples</Badge>
          </div>

          {loading ? (
            <div className="py-10 text-center">
              <div className="mx-auto h-7 w-7 animate-spin rounded-full border-3 border-emerald-700 border-t-transparent" />
              <p className="mt-3 text-sm font-semibold text-slate-700">Loading published inventory…</p>
            </div>
          ) : null}

          {!loading && ownProducts.length === 0 ? (
            <EmptyState
              title="No products published yet"
              description="Add commodities to start receiving wholesale orders from local kirana stores."
              icon={<Warehouse size={32} className="text-slate-400" />}
              action={
                <Button onClick={addProduct} size="md">
                  <Plus size={16} className="mr-1.5" /> Publish First Product
                </Button>
              }
            />
          ) : null}

          {!loading && ownProducts.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
                    <th className="px-3.5 py-3">Commodity</th>
                    <th className="px-3 py-3 text-center">Grade</th>
                    <th className="px-3.5 py-3 text-right">Wholesale Rate</th>
                    <th className="px-3.5 py-3 text-right">Stock</th>
                    <th className="px-3.5 py-3 text-right">MOQ</th>
                    <th className="px-3 py-3 text-center">Status</th>
                    <th className="px-3.5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {ownProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3.5 py-3.5">
                        <div className="flex min-w-44 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 border border-slate-200">
                            {product.image && (product.image.startsWith('data:') || product.image.startsWith('http')) ? (
                              <img src={product.image} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <Package size={20} className="text-slate-400" aria-hidden="true" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 leading-tight">{product.name}</p>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">{product.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-800">
                          Grade {product.grade}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-3.5 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(product.price)}{' '}
                        <span className="text-xs font-normal text-slate-500">/{product.unit}</span>
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-3.5 text-right font-semibold text-slate-800">
                        {product.stock} {product.unit}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-3.5 text-right text-xs font-semibold text-slate-700">
                        {product.minOrder} {product.unit}
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <Badge tone={product.isActive && product.stock > 0 ? 'success' : 'warning'} dot>
                          {product.isActive && product.stock > 0 ? 'Available' : product.stock === 0 ? 'Out of stock' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-3.5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Edit ${product.name}`}
                            onClick={() => editProduct(product)}
                            className="min-h-[36px] min-w-[36px] p-2"
                          >
                            <Pencil size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={product.isActive ? `Deactivate ${product.name}` : `Activate ${product.name}`}
                            disabled={busyProduct === product.id}
                            onClick={() => void runProductAction(product, () => toggleProductActive(product))}
                            className="min-h-[36px] min-w-[36px] p-2"
                          >
                            {product.isActive ? <EyeOff size={15} /> : <Eye size={15} />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Remove ${product.name}`}
                            disabled={busyProduct === product.id}
                            onClick={() => removeProduct(product)}
                            className="min-h-[36px] min-w-[36px] p-2 text-red-600 hover:text-red-800 hover:bg-red-50"
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        {/* Incoming Orders & Token Verification */}
        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          {/* Incoming Orders List */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="mb-4 flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Incoming Retailer Orders</h2>
                <p className="text-xs text-slate-600">Fulfill bags/packs assigned to your stall.</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void loadIncomingOrders()}
                disabled={incomingLoading}
                className="min-h-[36px]"
              >
                <RefreshCw size={13} className={`mr-1.5 ${incomingLoading ? 'animate-spin' : ''}`} /> Refresh
              </Button>
            </div>

            {incomingError ? (
              <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
                {incomingError}
              </div>
            ) : null}

            {incomingLoading ? (
              <div className="py-8 text-center text-xs font-semibold text-slate-500">
                Loading incoming orders…
              </div>
            ) : null}

            {!incomingLoading && !incomingOrders.length ? (
              <EmptyState
                title="No incoming orders"
                description="Orders placed by kirana retailers will appear here automatically."
                icon={<PackageCheck size={28} className="text-slate-400" />}
              />
            ) : null}

            {!incomingLoading && incomingOrders.length ? (
              <div className="max-h-[36rem] space-y-2.5 overflow-y-auto pr-1">
                {incomingOrders.map((incoming) => (
                  <button
                    key={incoming.subOrder.id}
                    type="button"
                    onClick={() => setSelectedIncoming(incoming)}
                    className="w-full text-left rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition hover:border-emerald-300 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-emerald-600 cursor-pointer group"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 pb-2 border-b border-slate-100">
                      <div>
                        <p className="font-bold text-slate-900 text-sm group-hover:text-emerald-900 transition-colors">{incoming.retailer.businessName}</p>
                        <p className="text-xs text-slate-500">
                          {incoming.retailer.shopNumber || 'Shop details on file'} · #{incoming.orderId.slice(0, 8).toUpperCase()}
                        </p>
                      </div>
                      <Badge
                        tone={
                          incoming.orderStatus === 'confirmed' || incoming.orderStatus === 'completed'
                            ? 'success'
                            : incoming.orderStatus === 'expired' || incoming.orderStatus === 'cancelled'
                              ? 'danger'
                              : 'warning'
                        }
                        dot
                      >
                        {incoming.orderStatus.replace('_', ' ')}
                      </Badge>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-xs">
                      <span className="font-extrabold text-slate-900 font-mono text-sm">
                        {formatCurrency(incoming.subOrder.amount)}
                      </span>
                      <span className="font-semibold text-slate-600">
                        {incoming.paymentMethod === 'cod' ? 'COD' : 'Online'} · {incoming.subOrder.items.length} {incoming.subOrder.items.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>

                    <p className="mt-2 text-[11px] text-emerald-700 font-semibold group-hover:text-emerald-800 transition-colors">
                      Click to view full order details →
                    </p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Token Verification & Checklist */}
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                  <KeyRound size={17} />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Verify Pickup Token</h2>
              </div>
              <p className="text-xs text-slate-600 mb-4">
                Ask the retailer or driver for their 8-character token to confirm order details and cash due.
              </p>

              <form onSubmit={(event) => void verifyPickup(event)} className="flex flex-col gap-2 sm:flex-row">
                <label className="sr-only" htmlFor="pickup-token">Pickup token</label>
                <input
                  id="pickup-token"
                  required
                  value={pickupToken}
                  onChange={(event) => setPickupToken(event.target.value)}
                  placeholder="e.g. KR-7F3K9Q"
                  className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-mono font-bold uppercase tracking-widest text-slate-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
                <Button type="submit" disabled={verifying} className="min-h-[44px] text-xs font-bold">
                  {verifying ? 'Checking…' : 'Verify Token'}
                </Button>
              </form>

              {verificationError ? (
                <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
                  {verificationError}
                </div>
              ) : null}

              {verification ? (
                <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2 pb-2 border-b border-emerald-200/60">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-900">Token Verified</p>
                      <p className="text-sm font-extrabold text-slate-900">{verification.retailer.businessName}</p>
                      <p className="text-xs text-slate-600">{verification.retailer.shopNumber}</p>
                    </div>
                    <Badge tone={verification.subOrderStatus === 'confirmed' || verification.subOrderStatus === 'completed' ? 'success' : 'warning'} dot>
                      {verification.subOrderStatus.replace('_', ' ')}
                    </Badge>
                  </div>

                  <div className="mt-3 text-xs text-slate-800 space-y-1">
                    <p className="font-semibold">
                      {verification.paymentStatus === 'paid'
                        ? 'Payment is paid in escrow; no cash due.'
                        : verification.paymentMethod === 'cod' && verification.paymentStatus === 'pending_cod'
                          ? `Collect ${formatCurrency(verification.amount)} in cash before releasing bags.`
                          : `Payment status: ${verification.paymentStatus.replace('_', ' ')}. Do not release until resolved.`}
                    </p>
                    {verification.retailer.contactPhone ? (
                      <p className="text-slate-600">
                        Contact: {verification.retailer.contactName} (
                        <a href={`tel:${verification.retailer.contactPhone}`} className="font-bold underline text-emerald-800">{verification.retailer.contactPhone}</a>)
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <h3 className="mb-3 text-sm font-bold text-slate-900">APMC Stall Guidelines</h3>
              <ul className="space-y-2.5 text-xs text-slate-700">
                <li className="flex gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-700 mt-0.5" />
                  <span>Always specify whether rates are per <strong>kg</strong> or per <strong>25kg bag</strong>.</span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-700 mt-0.5" />
                  <span>Update stock levels immediately when warehouse trucks arrive or depart.</span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-700 mt-0.5" />
                  <span>Never release goods without verifying the digital pickup token or driver manifest.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>
      <ProductEditorModal open={editorOpen} product={selectedProduct} onClose={closeEditor} />
      <IncomingOrderModal order={selectedIncoming} onClose={() => setSelectedIncoming(null)} />
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
  bg,
  isMonospace = false,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  bg: string;
  isMonospace?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 shadow-2xs ${bg}`}>
      <div className="mb-2.5 inline-flex rounded-xl bg-white p-2 shadow-2xs">{icon}</div>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-600">{label}</p>
      <p className={`mt-1 text-2xl font-black text-slate-900 ${isMonospace ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
