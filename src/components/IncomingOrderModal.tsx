import { useState } from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Download,
  MapPin,
  Package,
  PackageCheck,
  PhoneCall,
  Store,
  Truck,
  User,
} from 'lucide-react';
import { Badge } from './Badge';
import { Button } from './Button';
import { Modal } from './Modal';
import { DisputeSection } from './DisputeSection';
import { formatCurrency } from '../lib/formatters';
import { downloadWholesalerReceiptPdf } from '../lib/orderReceiptPdf';
import type { IncomingSubOrder } from '../services/demoOrders';

type IncomingOrderModalProps = {
  order: IncomingSubOrder | null;
  onClose: () => void;
  onConfirmPickup?: (orderId: string, subOrderId: string) => Promise<void>;
};

export function IncomingOrderModal({ order, onClose, onConfirmPickup }: IncomingOrderModalProps) {
  const [copied, setCopied] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [confirmingPickup, setConfirmingPickup] = useState(false);

  if (!order) return null;

  const handleDownloadPdf = () => {
    setDownloadingPdf(true);
    try {
      downloadWholesalerReceiptPdf(order);
    } finally {
      setTimeout(() => setDownloadingPdf(false), 1200);
    }
  };

  const copyOrderId = () => {
    navigator.clipboard?.writeText(order.orderId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentStatus = order.subOrder.status;
  const statusTone =
    currentStatus === 'confirmed' || currentStatus === 'completed'
      ? 'success'
      : currentStatus === 'placed'
        ? 'info'
        : currentStatus === 'expired' || currentStatus === 'cancelled'
          ? 'danger'
          : 'warning';

  const isTruckSlot = order.fulfilmentMethod === 'truck_slot' && Boolean(order.transport);

  return (
    <Modal
      open={Boolean(order)}
      title="Incoming Retailer Order Details"
      description={`Order #${order.orderId.slice(0, 8).toUpperCase()} · Assigned to your wholesale stall`}
      onClose={onClose}
      className="max-w-2xl"
    >
      <div className="space-y-5">
        {/* Header Summary Banner */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-base font-black text-slate-900">
                #{order.orderId.slice(0, 8).toUpperCase()}
              </span>
              <button
                type="button"
                onClick={copyOrderId}
                className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
                title="Copy Full Order ID"
              >
                {copied ? <Check size={12} className="text-emerald-700" /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy ID'}
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
                {currentStatus === 'placed' ? 'ORDER PLACED' : currentStatus.replace('_', ' ').toUpperCase()}
              </Badge>
              <Badge tone="neutral">
                Stall Sub-Order
              </Badge>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <Calendar size={14} className="text-slate-500" />
              <span>
                {new Date(order.orderCreatedAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={14} className="text-slate-500" />
              <span>
                {new Date(order.orderCreatedAt).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Two Column Grid: Retailer Info & Payment Info */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Retailer Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                <Store size={15} />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Retailer Details</h3>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase">Shop Name</p>
                <p className="font-bold text-slate-900 text-sm">{order.retailer.businessName}</p>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase">Shop / Stall Address</p>
                <p className="font-medium text-slate-800 flex items-start gap-1 mt-0.5">
                  <MapPin size={13} className="shrink-0 text-slate-400 mt-0.5" />
                  <span>{order.retailer.shopNumber || 'Address on file'}</span>
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase">Contact Person</p>
                <p className="font-semibold text-slate-900 flex items-center gap-1.5 mt-0.5">
                  <User size={13} className="text-slate-400" />
                  <span>{order.retailer.contactName}</span>
                </p>
              </div>

              {order.retailer.contactPhone ? (
                <div className="pt-2">
                  <a
                    href={`tel:${order.retailer.contactPhone}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 font-bold text-emerald-800 hover:bg-emerald-100 transition"
                  >
                    <PhoneCall size={13} />
                    <span>Call: {order.retailer.contactPhone}</span>
                  </a>
                </div>
              ) : null}
            </div>
          </div>

          {/* Payment & Settlement Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-800">
                <CreditCard size={15} />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Payment & Settlement</h3>
            </div>

            <div className="mt-3 space-y-3 text-xs">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase">Stall Amount Due</p>
                <p className="font-mono text-2xl font-black text-emerald-800">
                  {formatCurrency(order.subOrder.amount)}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Payment Mode:</span>
                  <span className="font-bold text-slate-900">
                    {order.paymentMethod === 'cod' ? 'Cash on Collection (COD)' : 'Online Escrow'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Payment Status:</span>
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

              {order.paymentMethod === 'cod' ? (
                <p className="text-[11px] font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2 leading-relaxed">
                  ⚠️ <strong>Cash Collection Required:</strong> Retailer must pay ₹{order.subOrder.amount} in cash upon loading/pickup.
                </p>
              ) : (
                <p className="text-[11px] font-medium text-emerald-950 bg-emerald-50 border border-emerald-200 rounded-lg p-2 leading-relaxed">
                  ✓ <strong>Online Escrow:</strong> Payment is held securely and will be settled to your registered bank account upon completion.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Fulfilment & Logistics Banner */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-800">
              {isTruckSlot ? <Truck size={15} /> : <PackageCheck size={15} />}
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Fulfilment & Dispatch</h3>
          </div>

          <div className="mt-3">
            {isTruckSlot && order.transport ? (
              <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 text-xs text-sky-950">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-bold text-sky-900 text-sm">
                    <Truck size={16} className="text-sky-700" /> Mandi Truck Dispatch
                  </span>
                  <span className="rounded-md bg-sky-100 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-800">
                    Slot #{order.transport.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>

                <div className="mt-3 grid gap-2.5 sm:grid-cols-2 pt-2 border-t border-sky-200/60">
                  <div>
                    <p className="text-[11px] font-semibold text-sky-700 uppercase">Pickup Schedule</p>
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
                    <p className="text-[11px] font-semibold text-sky-700 uppercase">Assigned Driver</p>
                    <p className="font-bold text-sky-950 mt-0.5">
                      {order.transport.driverName} ·{' '}
                      <a href={`tel:${order.transport.contactNumber}`} className="underline hover:text-sky-900">
                        {order.transport.contactNumber}
                      </a>
                    </p>
                  </div>
                </div>
                <p className="mt-2.5 text-[11px] text-sky-800">
                  Please keep bags packed and ready at your stall platform before the truck window begins.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-950">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-bold text-emerald-900 text-sm">
                    <PackageCheck size={16} className="text-emerald-700" /> Self-Pickup at Stall
                  </span>
                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                    Retailer Collection
                  </span>
                </div>
                <p className="mt-2 leading-relaxed text-emerald-900">
                  The retailer or their vehicle will arrive at your mandi stall directly.
                  Ask for their <strong>8-character pickup token</strong> before releasing bags/packs.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Ordered Commodities Breakdown Table */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                <Package size={15} />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Commodity Breakdown</h3>
            </div>
            <span className="text-xs font-bold text-slate-600">
              {order.subOrder.items.length} {order.subOrder.items.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="px-3 py-2.5">Commodity</th>
                  <th className="px-3 py-2.5 text-center">Grade</th>
                  <th className="px-3 py-2.5 text-right">Quantity</th>
                  <th className="px-3 py-2.5 text-right">Wholesale Rate</th>
                  <th className="px-3 py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {order.subOrder.items.map((item, index) => (
                  <tr key={`${order.subOrder.id}:${item.productId}:${index}`} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2.5">
                      <p className="font-bold text-slate-900 text-xs">{item.name}</p>
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
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 text-slate-900 font-bold">
                  <td colSpan={4} className="px-3 py-3 text-right uppercase text-[11px] tracking-wider text-slate-600">
                    Stall Total Payable:
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-sm font-black text-emerald-800">
                    {formatCurrency(order.subOrder.amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Issue Resolution / Dispute Section */}
        {order.orderStatus !== 'expired' && order.orderStatus !== 'cancelled' ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Communication & Order Issues
            </h3>
            <DisputeSection orderId={order.orderId} subOrderId={order.subOrder.id} />
          </div>
        ) : null}

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
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

            {currentStatus === 'placed' && onConfirmPickup ? (
              <Button
                type="button"
                size="md"
                disabled={confirmingPickup}
                onClick={async () => {
                  setConfirmingPickup(true);
                  try {
                    await onConfirmPickup(order.orderId, order.subOrder.id);
                  } finally {
                    setConfirmingPickup(false);
                  }
                }}
                className="min-h-[42px] font-bold text-xs bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs"
              >
                <PackageCheck size={15} className="mr-1.5" />
                {confirmingPickup ? 'Confirming…' : 'Confirm Pickup Done'}
              </Button>
            ) : currentStatus === 'confirmed' || currentStatus === 'completed' ? (
              <div className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-800">
                <CheckCircle2 size={15} className="text-emerald-600" />
                <span>Pickup Confirmed</span>
              </div>
            ) : null}
          </div>

          <Button onClick={onClose} size="md" className="min-h-[42px] px-6">
            Close Order
          </Button>
        </div>
      </div>
    </Modal>
  );
}

