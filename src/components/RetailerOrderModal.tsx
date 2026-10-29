import { useState } from 'react';
import {
  Calendar,
  Check,
  Clock,
  Copy,
  CreditCard,
  Download,
  Package,
  Phone,
  RotateCcw,
  Store,
  Truck,
} from 'lucide-react';
import { Badge } from './Badge';
import { Button } from './Button';
import { Modal } from './Modal';
import { DisputeSection } from './DisputeSection';
import { formatCurrency } from '../lib/formatters';
import { downloadRetailerReceiptPdf } from '../lib/orderReceiptPdf';
import type { OrderSummary } from '../services/demoOrders';

type RetailerOrderModalProps = {
  order: OrderSummary | null;
  onClose: () => void;
  reordering?: boolean;
  onReorder?: () => void;
};

export function RetailerOrderModal({
  order,
  onClose,
  reordering = false,
  onReorder,
}: RetailerOrderModalProps) {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  if (!order) return null;

  const handleDownloadPdf = () => {
    setDownloadingPdf(true);
    try {
      downloadRetailerReceiptPdf(order);
    } finally {
      setTimeout(() => setDownloadingPdf(false), 1200);
    }
  };

  const copyOrderId = () => {
    navigator.clipboard?.writeText(order.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const copyToken = () => {
    if (!order.pickupToken) return;
    navigator.clipboard?.writeText(order.pickupToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const statusTone =
    order.status === 'confirmed' || order.status === 'completed'
      ? 'success'
      : order.status === 'expired' || order.status === 'cancelled'
        ? 'danger'
        : 'warning';

  const isTruckSlot = order.fulfilmentMethod === 'truck_slot' && Boolean(order.transport);

  return (
    <Modal
      open={Boolean(order)}
      title="Mandi Wholesale Order Details"
      description={`Order #${order.id.slice(0, 8).toUpperCase()} · Placed on ${new Date(order.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })}`}
      onClose={onClose}
      className="max-w-2xl"
    >
      <div className="space-y-5">
        {/* Header Summary Ribbon */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-base font-black text-slate-900">
                #{order.id.slice(0, 8).toUpperCase()}
              </span>
              <button
                type="button"
                onClick={copyOrderId}
                className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
                title="Copy Full Order ID"
              >
                {copiedId ? <Check size={12} className="text-emerald-700" /> : <Copy size={12} />}
                {copiedId ? 'Copied' : 'Copy ID'}
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 hover:bg-emerald-50/60 transition shadow-2xs"
                title="Download Official Mandi Receipt (PDF)"
              >
                <Download size={12} className="text-emerald-700" />
                <span>{downloadingPdf ? 'Preparing…' : 'Receipt PDF'}</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={statusTone} dot>
                {order.status.replace('_', ' ').toUpperCase()}
              </Badge>
              <Badge
                tone={
                  order.paymentStatus === 'paid'
                    ? 'success'
                    : order.paymentStatus === 'failed' || order.paymentStatus === 'refunded'
                      ? 'danger'
                      : 'warning'
                }
              >
                {order.paymentStatus.replace('_', ' ')}
              </Badge>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-slate-600">
              <div className="flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-500" />
                <span>
                  {new Date(order.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={14} className="text-slate-500" />
                <span>
                  {new Date(order.createdAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-slate-500 font-medium">Total Amount: </span>
              <strong className="font-mono text-base text-emerald-900 font-black">
                {formatCurrency(order.subtotal)}
              </strong>
            </div>
          </div>
        </div>

        {/* High-Visibility Pickup Token Banner (if available) */}
        {order.pickupToken ? (
          <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/80 p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  Mandi Digital Pickup Token
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-mono text-2xl font-black tracking-widest text-emerald-950 bg-white border border-emerald-300 rounded-xl px-3.5 py-1 shadow-2xs">
                    {order.pickupToken}
                  </span>
                  <button
                    type="button"
                    onClick={copyToken}
                    className="inline-flex items-center gap-1 rounded-lg bg-white border border-emerald-300 px-2.5 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100/70 transition shadow-2xs"
                  >
                    {copiedToken ? <Check size={14} className="text-emerald-700" /> : <Copy size={14} />}
                    {copiedToken ? 'Copied' : 'Copy Token'}
                  </button>
                </div>
              </div>
              <p className="max-w-xs text-xs text-emerald-900 font-medium leading-relaxed">
                Show this verification token to stall operators or drivers when taking handover of your bags/commodities.
              </p>
            </div>
          </div>
        ) : null}

        {/* Fulfilment & Logistics Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-800">
              {isTruckSlot ? <Truck size={15} /> : <Store size={15} />}
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Fulfilment & Dispatch</h3>
          </div>

          <div className="mt-3">
            {isTruckSlot && order.transport ? (
              <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-3.5 text-xs text-sky-950">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-bold text-sky-900 text-sm">
                    <Truck size={16} className="text-sky-700" /> Mandi Truck Delivery
                  </span>
                  <span className="rounded-md bg-sky-100 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-800">
                    Slot #{order.transport.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>

                <div className="mt-3 grid gap-2.5 sm:grid-cols-2 pt-2 border-t border-sky-200/60">
                  <div>
                    <p className="text-[11px] font-semibold text-sky-700 uppercase">Estimated Delivery Window</p>
                    <p className="font-bold text-sky-950 mt-0.5">
                      {new Date(order.transport.startsAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      —{' '}
                      {new Date(order.transport.endsAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-sky-700 uppercase">Assigned Truck Driver</p>
                    <p className="font-bold text-sky-950 mt-0.5 flex items-center gap-1.5">
                      <span>{order.transport.driverName}</span>
                      <a
                        href={`tel:${order.transport.contactNumber}`}
                        className="inline-flex items-center gap-1 font-bold underline hover:text-sky-900 ml-1"
                      >
                        <Phone size={12} /> {order.transport.contactNumber}
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs text-slate-800">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <span className="inline-flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                    <Store size={16} className="text-emerald-700" /> Self-Pickup Collection Stalls ({order.subOrders.length})
                  </span>
                </div>
                <div className="mt-2.5 space-y-2">
                  {order.subOrders.map((subOrder, index) => (
                    <div key={subOrder.id} className="flex items-start gap-2.5 rounded-lg bg-white p-2.5 border border-slate-100">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="font-bold text-slate-900 truncate">{subOrder.wholesalerName}</p>
                          <span className="font-mono font-bold text-emerald-800 text-xs">
                            {formatCurrency(subOrder.amount)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          {subOrder.wholesalerShopNumber ? `Shop/Stall: ${subOrder.wholesalerShopNumber}` : 'APMC Mandi Yard'}
                          {subOrder.wholesalerContactPhone ? (
                            <> · <a href={`tel:${subOrder.wholesalerContactPhone}`} className="font-semibold text-emerald-700 hover:underline">Tel: {subOrder.wholesalerContactPhone}</a></>
                          ) : null}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payment Summary */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-800">
              <CreditCard size={15} />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Payment Breakdown</h3>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Payment Method</p>
              <p className="font-bold text-slate-900 mt-0.5">
                {order.paymentMethod === 'cod' ? 'Cash on Collection (COD)' : 'Online APMC Escrow'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Settlement Status</p>
              <p className="font-bold text-slate-900 mt-0.5">
                {order.paymentStatus === 'paid'
                  ? 'Paid in Full'
                  : order.paymentStatus === 'pending_cod'
                    ? 'Cash Payable on Collection'
                    : order.paymentStatus.replace('_', ' ')}
              </p>
            </div>
          </div>
          {order.paymentMethod === 'cod' ? (
            <p className="mt-2 text-[11px] font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2 leading-relaxed">
              ⚠️ <strong>Cash due on pickup:</strong> Please carry exact cash to pay each wholesaler stall directly upon collection.
            </p>
          ) : null}
        </div>

        {/* Ordered Commodities by Wholesaler Stall */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                <Package size={15} />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Purchased Commodities</h3>
            </div>
            <span className="text-xs font-bold text-slate-600">
              {order.subOrders.reduce((total, sub) => total + sub.items.length, 0)} total items
            </span>
          </div>

          <div className="mt-3 space-y-4">
            {order.subOrders.map((subOrder) => (
              <div key={subOrder.id} className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 text-xs">
                  <div>
                    <span className="font-bold text-slate-900">{subOrder.wholesalerName}</span>
                    {subOrder.wholesalerShopNumber ? (
                      <span className="text-slate-500 text-[11px] ml-1.5">({subOrder.wholesalerShopNumber})</span>
                    ) : null}
                  </div>
                  <span className="font-mono font-bold text-emerald-900">
                    Stall Total: {formatCurrency(subOrder.amount)}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-white text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="px-3.5 py-2">Item</th>
                        <th className="px-3 py-2 text-center">Grade</th>
                        <th className="px-3 py-2 text-right">Quantity</th>
                        <th className="px-3 py-2 text-right">Wholesale Rate</th>
                        <th className="px-3.5 py-2 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                      {subOrder.items.map((item, idx) => (
                        <tr key={`${subOrder.id}:${item.productId}:${idx}`} className="hover:bg-slate-50/60">
                          <td className="px-3.5 py-2.5">
                            <p className="font-bold text-slate-900">{item.name}</p>
                            <p className="text-[10px] uppercase font-semibold text-emerald-700">{item.category}</p>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                              {item.grade ? `Grade ${item.grade}` : 'Standard'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                            {formatCurrency(item.unitPrice)}/{item.unit}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(item.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {order.status !== 'expired' && order.status !== 'cancelled' ? (
                  <div className="p-3 bg-slate-50/50 border-t border-slate-100">
                    <DisputeSection orderId={order.id} subOrderId={subOrder.id} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-between items-baseline pt-3 border-t border-slate-200 text-slate-900 font-bold">
            <span className="uppercase text-xs tracking-wider text-slate-600">Final Order Total:</span>
            <span className="font-mono text-xl font-black text-emerald-900">
              {formatCurrency(order.subtotal)}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="min-h-[42px] font-bold text-xs"
            >
              <Download size={14} className="mr-1.5 text-slate-700" />
              {downloadingPdf ? 'Preparing Receipt…' : 'Download Receipt (PDF)'}
            </Button>

            {onReorder ? (
              <Button
                size="md"
                variant="secondary"
                disabled={reordering}
                onClick={onReorder}
                className="min-h-[42px] font-bold text-xs"
              >
                <RotateCcw size={14} className="mr-1.5" />
                {reordering ? 'Adding items to cart…' : 'Reorder All Staples'}
              </Button>
            ) : null}
          </div>

          <Button onClick={onClose} size="md" className="min-h-[42px] px-6">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

