import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CreditCard,
  MessageSquareWarning,
  Minus,
  PackageCheck,
  Plus,
  RotateCcw,
  ShieldAlert,
  ShoppingBag,
  Store,
  Trash2,
  Truck,
} from 'lucide-react';
import { useCart } from '../cart/useCart';
import { useCatalog } from '../catalog/useCatalog';
import { Badge } from '../components/Badge';
import { Button } from './../components/Button';
import { EmptyState } from '../components/EmptyState';
import { RetailerOrderModal } from '../components/RetailerOrderModal';
import { formatCurrency } from '../lib/formatters';
import type { OrderSummary } from '../services/demoOrders';

export function CartPage() {
  const {
    items,
    orders,
    slots,
    loading,
    saving,
    error: cartError,
    codOrderCap,
    onlinePaymentAvailable,
    subtotal,
    setQuantity,
    removeFromCart,
    placeOrder,
    completeMockPayment,
  } = useCart();
  const { products } = useCatalog();

  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('cod');
  const [fulfilmentMethod, setFulfilmentMethod] = useState<'truck_slot' | 'self_pickup'>('self_pickup');
  const [transportSlotId, setTransportSlotId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<OrderSummary | null>(null);
  const [pendingPaymentOrder, setPendingPaymentOrder] = useState<OrderSummary | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderSummary | null>(null);

  const updateQuantity = async (product: (typeof items)[number]['product'], nextQuantity: number) => {
    if (nextQuantity < product.minOrder) return;
    if (nextQuantity > product.stock) {
      setFormError(`Only ${product.stock} ${product.unit} available in stock.`);
      return;
    }
    try {
      await setQuantity(product, nextQuantity);
      setFormError(null);
    } catch (updateError) {
      setFormError(updateError instanceof Error ? updateError.message : 'Unable to update quantity.');
    }
  };

  const checkout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    try {
      const order = await placeOrder(paymentMethod, fulfilmentMethod, transportSlotId || undefined);
      if (order.paymentStatus === 'pending') setPendingPaymentOrder(order);
      else setCompletedOrder(order);
    } catch (checkoutError) {
      setFormError(checkoutError instanceof Error ? checkoutError.message : 'Unable to place this order.');
    }
  };

  const finishMockPayment = async (succeeded: boolean) => {
    if (!pendingPaymentOrder) return;
    setFormError(null);
    try {
      const order = await completeMockPayment(pendingPaymentOrder.id, succeeded);
      setPendingPaymentOrder(null);
      setCompletedOrder(order);
    } catch (paymentError) {
      setFormError(paymentError instanceof Error ? paymentError.message : 'Unable to record payment.');
    }
  };

  const handleReorder = async (order: OrderSummary) => {
    setReorderingId(order.id);
    setFormError(null);
    try {
      for (const subOrder of order.subOrders) {
        for (const item of subOrder.items) {
          const product = products.find((p) => p.id === item.productId);
          if (product && product.isActive && product.stock >= item.quantity) {
            await setQuantity(product, item.quantity);
          }
        }
      }
    } catch (reorderError) {
      setFormError(reorderError instanceof Error ? reorderError.message : 'Unable to reorder items.');
    } finally {
      setReorderingId(null);
    }
  };

  // Group items by wholesaler for clear mandi dispatch awareness
  const itemsByWholesaler = items.reduce<Record<string, { name: string; items: typeof items }>>((acc, entry) => {
    const sellerId = entry.product.wholesalerId;
    if (!acc[sellerId]) {
      acc[sellerId] = { name: entry.product.wholesalerName, items: [] };
    }
    acc[sellerId].items.push(entry);
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-slate-50 p-3 sm:p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/retailer"
          className="mb-4 inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-emerald-700 hover:text-emerald-900 transition min-h-[40px]"
        >
          <ArrowLeft size={16} /> Back to wholesale catalogue
        </Link>

        {/* Page Header */}
        <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Retailer Checkout</span>
              <span className="text-slate-400">·</span>
              <span className="text-xs font-semibold text-slate-600">APMC Mandi Dispatch</span>
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Wholesale Basket
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-600">
              Orders are packaged and collected per wholesaler stall with your combined pickup token.
            </p>
          </div>
          <Link
            to="/orders"
            className="text-xs sm:text-sm font-bold text-emerald-700 hover:text-emerald-900 hover:underline min-h-[36px] flex items-center"
          >
            Jump to order history ({orders.length})
          </Link>
        </header>

        {/* Status Confirmation & Payment Modals */}
        {completedOrder ? (
          <OrderConfirmation order={completedOrder} onDismiss={() => setCompletedOrder(null)} />
        ) : null}

        {pendingPaymentOrder ? (
          <MockPaymentPanel
            order={pendingPaymentOrder}
            saving={saving}
            onPaid={() => void finishMockPayment(true)}
            onFailed={() => void finishMockPayment(false)}
          />
        ) : null}

        {(cartError || formError) ? (
          <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm font-semibold text-red-800 flex items-start gap-3">
            <ShieldAlert size={18} className="text-red-700 shrink-0 mt-0.5" />
            <div>{formError ?? cartError}</div>
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-xs">
            <div className="mx-auto h-7 w-7 animate-spin rounded-full border-3 border-emerald-700 border-t-transparent" />
            <p className="mt-3 text-sm font-semibold text-slate-700">Loading your wholesale basket…</p>
          </div>
        ) : null}

        {/* Basket Content */}
        {!loading && items.length ? (
          <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
            {/* Basket Items List */}
            <section className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-base font-bold text-slate-900">
                  {items.length} {items.length === 1 ? 'Product Line' : 'Product Lines'} ({Object.keys(itemsByWholesaler).length} Stalls)
                </h2>
                <span className="text-xs text-slate-500 font-medium">Quantities match minimum order steps</span>
              </div>

              {Object.entries(itemsByWholesaler).map(([wholesalerId, group]) => {
                const groupSubtotal = group.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
                return (
                  <div key={wholesalerId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
                    {/* Wholesaler Subheader */}
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Store size={16} className="text-emerald-700 shrink-0" />
                        <span className="font-bold text-slate-900 text-sm">{group.name}</span>
                      </div>
                      <span className="font-mono text-xs font-bold text-slate-700">
                        Subtotal: {formatCurrency(groupSubtotal)}
                      </span>
                    </div>

                    {/* Items for this wholesaler */}
                    <div className="divide-y divide-slate-100">
                      {group.items.map(({ product, quantity }) => (
                        <article key={product.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                                {product.category}
                              </span>
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                                Grade {product.grade}
                              </span>
                            </div>
                            <h3 className="mt-0.5 text-sm sm:text-base font-bold text-slate-900 line-clamp-1">
                              {product.name}
                            </h3>
                            <p className="mt-0.5 text-xs text-slate-600">
                              <span className="font-mono font-bold text-slate-900">{formatCurrency(product.price)}</span> per {product.unit}
                              <span className="text-slate-400 mx-1.5">·</span>
                              MOQ: {product.minOrder} {product.unit}
                            </p>
                          </div>

                          <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-3 sm:border-0 sm:pt-0">
                            {/* Touch Quantity Stepper */}
                            <div className="flex items-center">
                              <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => void updateQuantity(product, quantity - product.minOrder)}
                                  disabled={quantity <= product.minOrder}
                                  className="flex h-10 w-10 items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent min-h-[40px] min-w-[40px]"
                                  aria-label={`Decrease quantity of ${product.name}`}
                                >
                                  <Minus size={15} />
                                </button>
                                <div className="px-2 text-center min-w-[50px]">
                                  <span className="text-sm font-extrabold font-mono text-slate-900">{quantity}</span>
                                  <span className="block text-[10px] font-semibold text-slate-500 leading-none">{product.unit}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void updateQuantity(product, quantity + product.minOrder)}
                                  disabled={quantity + product.minOrder > product.stock}
                                  className="flex h-10 w-10 items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent min-h-[40px] min-w-[40px]"
                                  aria-label={`Increase quantity of ${product.name}`}
                                >
                                  <Plus size={15} />
                                </button>
                              </div>
                            </div>

                            {/* Line Total & Remove */}
                            <div className="text-right">
                              <p className="text-base font-extrabold text-slate-900 font-mono">
                                {formatCurrency(product.price * quantity)}
                              </p>
                              <button
                                type="button"
                                onClick={() => void removeFromCart(product.id).catch((removeError: unknown) => setFormError(removeError instanceof Error ? removeError.message : 'Unable to remove product.'))}
                                className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-red-700 hover:text-red-900 hover:underline min-h-[36px] px-1"
                              >
                                <Trash2 size={13} /> Remove
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Sticky Order Summary & Checkout Form */}
            <aside className="sticky top-20">
              <form onSubmit={(event) => void checkout(event)} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Order Summary</h2>
                  <p className="mt-0.5 text-xs text-slate-600">Review terms and confirm collection method</p>
                </div>

                {/* Payment Selection */}
                <fieldset className="space-y-2">
                  <legend className="text-xs font-bold uppercase tracking-wider text-slate-700">Payment Terms</legend>
                  <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${paymentMethod === 'cod' ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600' : 'border-slate-200 hover:bg-slate-50'
                    }`}>
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === 'cod'}
                      onChange={() => setPaymentMethod('cod')}
                      className="mt-1 h-4 w-4 text-emerald-700 focus:ring-emerald-600"
                    />
                    <div>
                      <span className="block text-sm font-bold text-slate-900">Cash on Collection (COD)</span>
                      <span className="mt-0.5 block text-xs text-slate-600">
                        Settle directly at each stall during pickup. Max order: {formatCurrency(codOrderCap)}.
                      </span>
                    </div>
                  </label>

                  <label className={`flex items-start gap-3 rounded-xl border p-3.5 transition ${!onlinePaymentAvailable
                    ? 'border-slate-200 opacity-60 cursor-not-allowed bg-slate-50'
                    : paymentMethod === 'online'
                      ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600 cursor-pointer'
                      : 'border-slate-200 hover:bg-slate-50 cursor-pointer'
                    }`}>
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === 'online'}
                      disabled={!onlinePaymentAvailable}
                      onChange={() => setPaymentMethod('online')}
                      className="mt-1 h-4 w-4 text-emerald-700 focus:ring-emerald-600"
                    />
                    <div>
                      <span className="block text-sm font-bold text-slate-800">Online Mandi Escrow (Demo)</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {onlinePaymentAvailable ? 'Instant sandbox settlement.' : 'Online escrow not available in this demo.'}
                      </span>
                    </div>
                  </label>
                </fieldset>

                {/* Fulfilment Method Selection */}
                <fieldset className="space-y-2">
                  <legend className="text-xs font-bold uppercase tracking-wider text-slate-700">Collection / Transport</legend>
                  <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${fulfilmentMethod === 'self_pickup' ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600' : 'border-slate-200 hover:bg-slate-50'
                    }`}>
                    <input
                      type="radio"
                      name="fulfilment"
                      checked={fulfilmentMethod === 'self_pickup'}
                      onChange={() => setFulfilmentMethod('self_pickup')}
                      className="mt-1 h-4 w-4 text-emerald-700 focus:ring-emerald-600"
                    />
                    <div>
                      <span className="block text-sm font-bold text-slate-900">Self Pickup at APMC</span>
                      <span className="mt-0.5 block text-xs text-slate-600">
                        Collect with your token directly from each wholesaler stall.
                      </span>
                    </div>
                  </label>

                  <label className={`flex items-start gap-3 rounded-xl border p-3.5 transition ${!slots.length
                    ? 'border-slate-200 opacity-60 cursor-not-allowed bg-slate-50'
                    : fulfilmentMethod === 'truck_slot'
                      ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600 cursor-pointer'
                      : 'border-slate-200 hover:bg-slate-50 cursor-pointer'
                    }`}>
                    <input
                      type="radio"
                      name="fulfilment"
                      checked={fulfilmentMethod === 'truck_slot'}
                      disabled={!slots.length}
                      onChange={() => setFulfilmentMethod('truck_slot')}
                      className="mt-1 h-4 w-4 text-emerald-700 focus:ring-emerald-600"
                    />
                    <div>
                      <span className="block text-sm font-bold text-slate-800">Mandi Truck Dispatch</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {slots.length ? 'Reserve a scheduled truck delivery slot.' : 'No truck slots available right now.'}
                      </span>
                    </div>
                  </label>

                  {fulfilmentMethod === 'truck_slot' && slots.length ? (
                    <select
                      required
                      value={transportSlotId}
                      onChange={(event) => setTransportSlotId(event.target.value)}
                      className="mt-2 w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-600"
                    >
                      <option value="">Select an available truck slot</option>
                      {slots.map((slot) => (
                        <option key={slot.id} value={slot.id}>
                          {new Date(slot.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {slot.driverName} ({slot.capacity - slot.reservedCount} spots left)
                        </option>
                      ))}
                    </select>
                  ) : null}
                </fieldset>

                {/* Subtotal & Action */}
                <div className="border-t border-slate-100 pt-4 space-y-2">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Items Subtotal</span>
                    <span className="font-mono font-bold text-slate-900">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Mandi Market Cess / Fee</span>
                    <span className="font-semibold text-emerald-700">Included</span>
                  </div>
                  <div className="border-t border-slate-100 pt-2 flex items-baseline justify-between text-slate-900">
                    <span className="text-base font-extrabold">Final Payable</span>
                    <span className="text-2xl font-black font-mono text-emerald-800">{formatCurrency(subtotal)}</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full min-h-[48px] text-sm font-bold shadow-sm"
                  disabled={saving || !items.length}
                >
                  {saving ? 'Placing wholesale order…' : 'Place Wholesale Order'}
                </Button>
              </form>
            </aside>
          </div>
        ) : null}

        {/* Empty Basket State */}
        {!loading && !items.length ? (
          <EmptyState
            title="Your wholesale basket is empty"
            description="Add minimum orders from the catalogue to start your wholesale purchase. All previous orders remain tracked below."
            icon={<ShoppingBag size={32} className="text-slate-400" />}
            action={
              <Link to="/retailer">
                <Button size="md" className="min-h-[44px]">Browse Catalogue</Button>
              </Link>
            }
          />
        ) : null}

        {/* Order History Section with 1-Click Reorder */}
        <section className="mt-12">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Recent Mandi Orders</h2>
              <p className="text-xs text-slate-600">Track tokens, collection status, and easily reorder staples.</p>
            </div>
            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-800">
              {orders.length} Placed Orders
            </span>
          </div>

          {orders.length ? (
            <div className="space-y-4">
              {orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  reordering={reorderingId === order.id}
                  onReorder={() => void handleReorder(order)}
                  onSelect={() => setSelectedOrder(order)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-medium text-slate-500">
              Your placed orders and pickup tokens will appear here.
            </div>
          )}
        </section>
        <RetailerOrderModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          reordering={selectedOrder ? reorderingId === selectedOrder.id : false}
          onReorder={selectedOrder ? () => void handleReorder(selectedOrder) : undefined}
        />
      </div>
    </main>
  );
}

function OrderConfirmation({ order, onDismiss }: { order: OrderSummary; onDismiss: () => void }) {
  const failed = order.status === 'expired' || order.paymentStatus === 'failed';
  return (
    <section
      aria-live="polite"
      className={`mb-6 rounded-2xl border p-5 sm:p-6 shadow-sm ${failed ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'
        }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3.5">
          <PackageCheck className={`mt-0.5 shrink-0 ${failed ? 'text-amber-700' : 'text-emerald-700'}`} size={26} />
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              {failed
                ? 'Mock payment expired or failed'
                : order.paymentMethod === 'online'
                  ? 'Payment confirmed & order booked'
                  : 'Order successfully placed'}
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm font-semibold text-slate-700">
              Order #{order.id.slice(0, 8).toUpperCase()} · Total: <span className="font-mono font-bold">{formatCurrency(order.subtotal)}</span>
            </p>

            {/* High-visibility pickup token */}
            {order.pickupToken && !failed ? (
              <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-3.5 py-2 shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Self Pickup Token:</span>
                <strong className="text-xl font-black font-mono tracking-widest text-emerald-900">{order.pickupToken}</strong>
              </div>
            ) : null}

            {!failed ? <OrderFulfilmentDetails order={order} /> : null}

            <p className="mt-2 text-xs text-slate-600">
              {failed
                ? 'The product reservation expired. Please re-add items from the catalogue to place a fresh order.'
                : order.paymentMethod === 'cod'
                  ? 'Cash on delivery is payable directly to each wholesaler upon showing your token.'
                  : 'Mock escrow payment recorded complete for this demo.'}
            </p>
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={onDismiss} className="self-start min-h-[38px]">
          Dismiss
        </Button>
      </div>
    </section>
  );
}

function MockPaymentPanel({
  order,
  saving,
  onPaid,
  onFailed,
}: {
  order: OrderSummary;
  saving: boolean;
  onPaid: () => void;
  onFailed: () => void;
}) {
  return (
    <section aria-live="polite" className="mb-6 rounded-2xl border border-sky-300 bg-sky-50 p-5 shadow-xs">
      <div className="flex items-start gap-3">
        <CreditCard size={22} className="text-sky-700 shrink-0 mt-0.5" />
        <div>
          <h2 className="font-extrabold text-sky-950 text-base">
            Payment Simulation · Order #{order.id.slice(0, 8).toUpperCase()}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-sky-900">
            This is an APMC escrow test environment. Select an outcome to simulate the payment workflow.
          </p>
          {order.reservationExpiresAt ? (
            <p className="mt-1.5 text-xs font-semibold text-sky-800">
              Stock reservation holds until {new Date(order.reservationExpiresAt).toLocaleTimeString()}.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Button disabled={saving} onClick={onPaid} size="sm" className="min-h-[40px]">
              {saving ? 'Recording…' : 'Simulate Successful Payment'}
            </Button>
            <Button variant="secondary" disabled={saving} onClick={onFailed} size="sm" className="min-h-[40px]">
              Simulate Failed Payment
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function OrderCard({
  order,
  reordering,
  onReorder,
  onSelect,
}: {
  order: OrderSummary;
  reordering: boolean;
  onReorder: () => void;
  onSelect: () => void;
}) {
  const statusTone =
    order.status === 'confirmed' || order.status === 'completed'
      ? 'success'
      : order.status === 'placed'
        ? 'info'
        : order.status === 'expired' || order.status === 'cancelled'
          ? 'danger'
          : 'warning';

  return (
    <article
      tabIndex={0}
      role="button"
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-emerald-300 hover:shadow-md cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-extrabold text-slate-900 group-hover:text-emerald-900 transition-colors">
              #{order.id.slice(0, 8).toUpperCase()}
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-xs text-slate-500 font-medium">
              {new Date(order.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          <p className="mt-0.5 text-sm font-bold text-slate-800 font-mono">
            {formatCurrency(order.subtotal)}{' '}
            <span className="font-sans font-normal text-xs text-slate-500">
              via {order.paymentMethod === 'cod' ? 'Cash on Collection' : 'Online Escrow'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge tone={statusTone} dot>
            {order.status === 'placed' ? 'Order Placed' : order.status.replace('_', ' ')}
          </Badge>
          <Button
            size="sm"
            variant="secondary"
            onClick={(event) => {
              event.stopPropagation();
              onSelect();
            }}
            className="min-h-[36px] text-xs font-semibold"
          >
            View Details
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={reordering}
            onClick={(event) => {
              event.stopPropagation();
              onReorder();
            }}
            className="min-h-[36px] text-xs font-bold"
            title="Add all items from this order into your cart"
          >
            <RotateCcw size={13} className="mr-1" />
            {reordering ? 'Adding…' : 'Reorder'}
          </Button>
        </div>
      </header>

      {/* Prominent Pickup Token */}
      {order.pickupToken ? (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 p-2.5 border border-slate-100">
          <span className="text-xs font-semibold text-slate-700">Mandi Pickup Token:</span>
          <span className="font-mono font-black text-base text-emerald-900 bg-emerald-100/70 border border-emerald-300 rounded-lg px-2.5 py-0.5 tracking-wider">
            {order.pickupToken}
          </span>
        </div>
      ) : null}

      <OrderFulfilmentDetails order={order} />

      {/* Multi-wholesaler breakdown */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {order.subOrders.map((subOrder) => (
          <div key={subOrder.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
            <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-900">
              <span className="truncate">{subOrder.wholesalerName}</span>
              <span className="font-mono">{formatCurrency(subOrder.amount)}</span>
            </div>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {subOrder.items.map((item) => (
                <li key={`${item.productId}:${item.name}`} className="flex justify-between">
                  <span className="truncate">{item.name}</span>
                  <span className="font-mono text-slate-800">{item.quantity} {item.unit}</span>
                </li>
              ))}
            </ul>
            {order.status !== 'expired' && order.status !== 'cancelled' ? (
              <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500">Order issue?</span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect();
                  }}
                  className="inline-flex items-center gap-1 font-bold text-amber-800 hover:text-amber-950 text-xs hover:underline cursor-pointer"
                >
                  <MessageSquareWarning size={12} /> Raise Dispute in Details →
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] font-semibold text-emerald-700 group-hover:text-emerald-800 transition-colors">
        Click order card to view full structured details →
      </p>
    </article>
  );
}

function OrderFulfilmentDetails({ order }: { order: OrderSummary }) {
  if (order.fulfilmentMethod === 'truck_slot') {
    if (!order.transport) return null;
    return (
      <section className="mt-3 rounded-xl border border-sky-200 bg-sky-50/80 p-3 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-sky-950">
          <Truck size={15} /> Mandi Truck Delivery
        </div>
        <p className="mt-1 text-sky-900">
          Scheduled: <strong className="font-mono">{new Date(order.transport.startsAt).toLocaleString('en-IN')}</strong> · Driver: {order.transport.driverName}
        </p>
        <p className="mt-0.5 text-sky-800">
          Contact: <a className="font-bold underline" href={`tel:${order.transport.contactNumber}`}>{order.transport.contactNumber}</a>
        </p>
      </section>
    );
  }

  const stops = [...order.subOrders].sort((left, right) => left.wholesalerName.localeCompare(right.wholesalerName));
  return (
    <section className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
      <div className="flex items-center gap-1.5 font-bold text-slate-900">
        <Store size={15} className="text-emerald-700" /> Self-Pickup Collection Stalls ({stops.length})
      </div>
      <ol className="mt-2 space-y-2">
        {stops.map((stop, index) => (
          <li key={stop.id} className="flex items-start gap-2 text-slate-800">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold">
              {index + 1}
            </span>
            <div className="min-w-0">
              <strong className="text-slate-900">{stop.wholesalerName}</strong>
              {stop.wholesalerShopNumber ? <span className="text-slate-600"> · Shop {stop.wholesalerShopNumber}</span> : null}
              {(stop.wholesalerContactName || stop.wholesalerContactPhone) ? (
                <p className="text-[11px] text-slate-500">
                  {stop.wholesalerContactName ?? 'Stall Contact'}
                  {stop.wholesalerContactPhone ? (
                    <> · <a className="font-semibold text-emerald-700 hover:underline" href={`tel:${stop.wholesalerContactPhone}`}>{stop.wholesalerContactPhone}</a></>
                  ) : null}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
