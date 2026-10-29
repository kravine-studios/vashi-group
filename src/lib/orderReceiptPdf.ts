import { formatCurrency } from './formatters';
import type { IncomingSubOrder, OrderSummary, OrderLine } from '../services/demoOrders';

interface ReceiptData {
  orderId: string;
  orderCreatedAt: string;
  orderStatus: string;
  paymentMethod: string;
  paymentStatus: string;
  fulfilmentMethod: string;
  pickupToken: string | null;
  grandTotal: number;
  retailer: {
    businessName: string;
    shopNumber?: string;
    contactName?: string;
    contactPhone?: string;
    address?: string;
  };
  transport: {
    id?: string;
    startsAt?: string;
    endsAt?: string;
    driverName?: string;
    contactNumber?: string;
  } | null;
  subOrders: Array<{
    wholesalerName: string;
    wholesalerShopNumber?: string | null;
    wholesalerContactName?: string | null;
    wholesalerContactPhone?: string | null;
    amount: number;
    items: OrderLine[];
  }>;
  isWholesalerView?: boolean;
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function generateReceiptHtml(data: ReceiptData): string {
  const shortId = data.orderId.slice(0, 8).toUpperCase();
  const fullId = data.orderId.toUpperCase();
  const dateFormatted = formatDate(data.orderCreatedAt);
  const isTruck = data.fulfilmentMethod === 'truck_slot';

  const statusColor =
    data.orderStatus === 'confirmed' || data.orderStatus === 'completed'
      ? '#059669'
      : data.orderStatus === 'cancelled' || data.orderStatus === 'expired'
        ? '#dc2626'
        : '#d97706';

  const paymentToneColor =
    data.paymentStatus === 'paid'
      ? '#059669'
      : data.paymentStatus === 'pending_cod'
        ? '#0284c7'
        : '#d97706';

  // Compute total items count
  const allItems = data.subOrders.flatMap((so) =>
    so.items.map((item) => ({ ...item, wholesalerName: so.wholesalerName, stall: so.wholesalerShopNumber }))
  );

  const rowsHtml = allItems
    .map((item, index) => {
      const lineTotalFormatted = formatCurrency(item.lineTotal);
      const unitPriceFormatted = formatCurrency(item.unitPrice);
      const gradeBadge = item.grade
        ? `<span style="display:inline-block;padding:1px 6px;border-radius:4px;background:#f1f5f9;font-size:10px;font-weight:700;color:#334155;border:1px solid #cbd5e1;">Grade ${escapeHtml(
            item.grade
          )}</span>`
        : '<span style="color:#64748b;font-size:11px;">Standard</span>';

      const stallSub = !data.isWholesalerView
        ? `<div style="font-size:10px;color:#64748b;margin-top:2px;">Stall: ${escapeHtml(item.wholesalerName)}${
            item.stall ? ` (${escapeHtml(item.stall)})` : ''
          }</div>`
        : '';

      return `
        <tr style="border-bottom:1px solid #e2e8f0;background:${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding:9px 10px;text-align:center;font-size:11px;color:#64748b;font-family:monospace;">${index + 1}</td>
          <td style="padding:9px 12px;font-size:12px;color:#0f172a;">
            <div style="font-weight:700;">${escapeHtml(item.name)}</div>
            <div style="font-size:10px;font-weight:600;color:#047857;text-transform:uppercase;margin-top:1px;">${escapeHtml(
              item.category
            )}</div>
            ${stallSub}
          </td>
          <td style="padding:9px 8px;text-align:center;">${gradeBadge}</td>
          <td style="padding:9px 10px;text-align:right;font-family:monospace;font-weight:700;font-size:12px;color:#0f172a;">
            ${item.quantity} ${escapeHtml(item.unit)}
          </td>
          <td style="padding:9px 10px;text-align:right;font-family:monospace;font-size:11px;color:#475569;">
            ${unitPriceFormatted}/${escapeHtml(item.unit)}
          </td>
          <td style="padding:9px 12px;text-align:right;font-family:monospace;font-weight:800;font-size:12px;color:#0f172a;">
            ${lineTotalFormatted}
          </td>
        </tr>
      `;
    })
    .join('');

  const supplierHtml = data.isWholesalerView
    ? `
      <div style="flex:1;min-width:240px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;margin-bottom:6px;">Wholesale Stall (Supplier)</div>
        <div style="font-size:14px;font-weight:800;color:#0f172a;">${escapeHtml(data.subOrders[0]?.wholesalerName || 'APMC Wholesaler')}</div>
        <div style="font-size:11px;color:#475569;margin-top:2px;">Shop/Stall: ${escapeHtml(data.subOrders[0]?.wholesalerShopNumber || 'APMC Market Yard')}</div>
        ${
          data.subOrders[0]?.wholesalerContactName
            ? `<div style="font-size:11px;color:#475569;">Contact: ${escapeHtml(data.subOrders[0].wholesalerContactName)} (${escapeHtml(
                data.subOrders[0].wholesalerContactPhone || ''
              )})</div>`
            : ''
        }
        <div style="font-size:10px;color:#64748b;margin-top:4px;">Sector 19, APMC Mandi, Vashi, Navi Mumbai - 400705</div>
      </div>
    `
    : `
      <div style="flex:1;min-width:240px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;margin-bottom:6px;">Supplying Wholesale Stalls</div>
        ${data.subOrders
          .map(
            (so) => `
          <div style="margin-bottom:6px;padding-bottom:6px;border-bottom:1px dashed #cbd5e1;">
            <div style="font-size:12px;font-weight:700;color:#0f172a;">${escapeHtml(so.wholesalerName)}</div>
            <div style="font-size:11px;color:#475569;">Stall: ${escapeHtml(so.wholesalerShopNumber || 'APMC Yard')} · Subtotal: ${formatCurrency(
              so.amount
            )}</div>
          </div>
        `
          )
          .join('')}
        <div style="font-size:10px;color:#64748b;">APMC Grain &amp; Spice Complex, Vashi, Navi Mumbai</div>
      </div>
    `;

  const transportHtml =
    isTruck && data.transport
      ? `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>
            <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:#166534;">Coordinated APMC Transport Dispatch</div>
            <div style="font-size:12px;font-weight:700;color:#14532d;margin-top:2px;">
              Driver: ${escapeHtml(data.transport.driverName || 'APMC Fleet Driver')} · Contact: ${escapeHtml(
          data.transport.contactNumber || 'Available at dispatch'
        )}
            </div>
            ${
              data.transport.startsAt
                ? `<div style="font-size:11px;color:#166534;margin-top:2px;">Departure Window: ${formatDate(
                    data.transport.startsAt
                  )} – ${formatDate(data.transport.endsAt || data.transport.startsAt)}</div>`
                : ''
            }
          </div>
          <div style="text-align:right;">
            <span style="display:inline-block;padding:3px 8px;background:#dcfce7;border:1px solid #86efac;border-radius:4px;font-size:10px;font-weight:800;color:#15803d;text-transform:uppercase;">
              Slot Confirmed
            </span>
          </div>
        </div>
      </div>
    `
      : `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;margin-bottom:16px;">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:#475569;">Mandi Collection Method</div>
        <div style="font-size:12px;font-weight:700;color:#0f172a;margin-top:2px;">
          Direct Self-Pickup at APMC Wholesaler Stall
        </div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">Present the official Security Pickup Token below at the stall loading bay for dispatch clearance.</div>
      </div>
    `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Receipt-${shortId}.pdf</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
    }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 12px;
      line-height: 1.45;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .no-print {
        display: none !important;
      }
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
  </style>
</head>
<body>
  <div style="max-width:800px;margin:0 auto;padding:16px 20px;">
    
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:14px;margin-bottom:16px;">
      <div>
        <div style="display:inline-block;padding:2px 8px;border-radius:4px;background:#0f172a;color:#ffffff;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">
          APMC Vashi Wholesale Mandi
        </div>
        <h1 style="margin:2px 0 0;font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-0.5px;">
          Commercial Mandi Receipt &amp; Gate Pass
        </h1>
        <div style="font-size:11px;color:#475569;margin-top:2px;">
          Sector 19, APMC Market Complex, Vashi, Navi Mumbai, Maharashtra 400705
        </div>
        <div style="font-size:10px;color:#64748b;margin-top:1px;">
          GSTIN: 27AAAPV1992V1Z9 · Agricultural Produce Market Yard Hub
        </div>
      </div>

      <div style="text-align:right;">
        <div style="font-family:monospace;font-size:15px;font-weight:900;color:#0f172a;">
          #${shortId}
        </div>
        <div style="font-size:10px;font-family:monospace;color:#64748b;margin-top:1px;">
          ID: ${fullId}
        </div>
        <div style="font-size:11px;color:#475569;margin-top:4px;">
          <strong>Date:</strong> ${dateFormatted}
        </div>
        <div style="margin-top:6px;display:flex;gap:4px;justify-content:flex-end;">
          <span style="display:inline-block;padding:2px 6px;border-radius:4px;background:${statusColor}15;border:1px solid ${statusColor};color:${statusColor};font-size:10px;font-weight:800;text-transform:uppercase;">
            ${escapeHtml(data.orderStatus.replace('_', ' '))}
          </span>
          <span style="display:inline-block;padding:2px 6px;border-radius:4px;background:${paymentToneColor}15;border:1px solid ${paymentToneColor};color:${paymentToneColor};font-size:10px;font-weight:800;text-transform:uppercase;">
            ${escapeHtml(data.paymentStatus.replace('_', ' '))}
          </span>
        </div>
      </div>
    </div>

    <!-- Pickup Token / Gate Clearance Banner -->
    <div style="display:flex;justify-content:space-between;align-items:center;background:#047857;color:#ffffff;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
      <div>
        <div style="font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#a7f3d0;">
          Mandi Gate Pass &amp; Loading Token
        </div>
        <div style="font-family:monospace;font-size:20px;font-weight:900;letter-spacing:2px;margin-top:2px;">
          ${data.pickupToken ? escapeHtml(data.pickupToken) : `TOK-${shortId}`}
        </div>
        <div style="font-size:10px;color:#d1fae5;margin-top:2px;">
          Present this verified token at APMC security checkpoint and wholesale stall for item release.
        </div>
      </div>
      <div style="text-align:right;border-left:1px solid #065f46;padding-left:16px;">
        <div style="font-size:10px;color:#a7f3d0;text-transform:uppercase;font-weight:700;">Payment Method</div>
        <div style="font-size:13px;font-weight:800;margin-top:1px;text-transform:uppercase;">
          ${escapeHtml(data.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Prepaid')}
        </div>
        <div style="font-size:10px;color:#d1fae5;margin-top:2px;">
          Total Payable: ${formatCurrency(data.grandTotal)}
        </div>
      </div>
    </div>

    <!-- Parties Grid (Supplier & Buyer) -->
    <div style="display:flex;gap:14px;margin-bottom:16px;flex-wrap:wrap;">
      <!-- Supplier -->
      ${supplierHtml}

      <!-- Buyer -->
      <div style="flex:1;min-width:240px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;margin-bottom:6px;">Retail Kirana Buyer</div>
        <div style="font-size:14px;font-weight:800;color:#0f172a;">${escapeHtml(data.retailer.businessName || 'Retailer Shop')}</div>
        <div style="font-size:11px;color:#475569;margin-top:2px;">Shop/Stall: ${escapeHtml(data.retailer.shopNumber || 'Retail Counter')}</div>
        ${
          data.retailer.contactName
            ? `<div style="font-size:11px;color:#475569;">Contact: ${escapeHtml(data.retailer.contactName)} (${escapeHtml(
                data.retailer.contactPhone || ''
              )})</div>`
            : ''
        }
        <div style="font-size:10px;color:#64748b;margin-top:4px;">${escapeHtml(
          data.retailer.address || 'APMC Delivery Catchment, Mumbai Suburban'
        )}</div>
      </div>
    </div>

    <!-- Fulfilment / Transport Banner -->
    ${transportHtml}

    <!-- Commodity Items Table -->
    <div style="border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;margin-bottom:16px;">
      <table>
        <thead>
          <tr style="background:#0f172a;color:#ffffff;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">
            <th style="padding:8px 10px;text-align:center;width:36px;">#</th>
            <th style="padding:8px 12px;text-align:left;">Item &amp; Category</th>
            <th style="padding:8px 8px;text-align:center;width:75px;">Grade</th>
            <th style="padding:8px 10px;text-align:right;width:90px;">Quantity</th>
            <th style="padding:8px 10px;text-align:right;width:105px;">Wholesale Rate</th>
            <th style="padding:8px 12px;text-align:right;width:115px;">Line Total</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>

    <!-- Financial Breakdown & Totals -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:20px;">
      <div style="flex:1;font-size:10px;color:#64748b;line-height:1.5;">
        <div style="font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">APMC Market Yard Declarations:</div>
        <div>1. Certified that goods specified in this delivery slip are genuine APMC commodities traded under APMC Act.</div>
        <div>2. Grains, pulses, and spices are agricultural produce exempt from Central GST as per Notification No. 2/2017-CT.</div>
        <div>3. Gate clearance is electronic. Verification officer can scan or check Token #${data.pickupToken || shortId}.</div>
      </div>

      <div style="width:260px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:12px;">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:#475569;margin-bottom:4px;">
          <span>Commodity Subtotal:</span>
          <span style="font-family:monospace;font-weight:700;color:#0f172a;">${formatCurrency(data.grandTotal)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:#475569;margin-bottom:4px;">
          <span>APMC Market Cess (0%):</span>
          <span style="font-family:monospace;font-weight:600;color:#059669;">Nil (Exempt)</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:#475569;margin-bottom:8px;padding-bottom:6px;border-bottom:1px dashed #cbd5e1;">
          <span>Transport Fee:</span>
          <span style="font-family:monospace;font-weight:600;color:#0f172a;">${isTruck ? 'Included' : 'Self-Collection'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:14px;font-weight:900;color:#065f46;">
          <span>Final Total:</span>
          <span style="font-family:monospace;font-size:16px;">${formatCurrency(data.grandTotal)}</span>
        </div>
      </div>
    </div>

    <!-- Signatures & Seal Box -->
    <div style="display:flex;justify-content:space-between;margin-top:24px;padding-top:16px;border-top:1px dashed #cbd5e1;">
      <div style="text-align:center;width:200px;">
        <div style="height:45px;border-bottom:1px solid #94a3b8;"></div>
        <div style="font-size:10px;font-weight:700;color:#475569;margin-top:6px;text-transform:uppercase;">Wholesaler Stall / Dispatcher Stamp</div>
      </div>
      <div style="text-align:center;width:180px;">
        <div style="display:inline-block;border:2px solid #059669;color:#059669;padding:6px 12px;border-radius:6px;font-size:10px;font-weight:900;letter-spacing:1px;text-transform:uppercase;">
          ✓ APMC VERIFIED
        </div>
        <div style="font-size:9px;color:#64748b;margin-top:4px;">Official Digital Clearance</div>
      </div>
      <div style="text-align:center;width:200px;">
        <div style="height:45px;border-bottom:1px solid #94a3b8;"></div>
        <div style="font-size:10px;font-weight:700;color:#475569;margin-top:6px;text-transform:uppercase;">Retailer Receiving Signature</div>
      </div>
    </div>

  </div>
</body>
</html>`;
}

/**
 * Triggers the browser's native Print to PDF engine with an isolated iframe.
 * The document title is set to "Receipt-ORD-XXXXX.pdf" so browsers default to saving as a PDF file.
 */
export function triggerReceiptPdf(data: ReceiptData): void {
  const htmlContent = generateReceiptHtml(data);
  const iframe = document.createElement('iframe');

  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    // Fallback: open in new window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
    return;
  }

  doc.open();
  doc.write(htmlContent);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      }
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 3000);
    }
  }, 350);
}

/**
 * Downloads receipt PDF for an incoming wholesale stall sub-order.
 */
export function downloadWholesalerReceiptPdf(incoming: IncomingSubOrder): void {
  const data: ReceiptData = {
    orderId: incoming.orderId,
    orderCreatedAt: incoming.orderCreatedAt,
    orderStatus: incoming.orderStatus,
    paymentMethod: incoming.paymentMethod,
    paymentStatus: incoming.paymentStatus,
    fulfilmentMethod: incoming.fulfilmentMethod,
    pickupToken: incoming.pickupToken,
    grandTotal: incoming.subOrder.amount,
    retailer: incoming.retailer,
    transport: incoming.transport,
    subOrders: [incoming.subOrder],
    isWholesalerView: true,
  };

  triggerReceiptPdf(data);
}

/**
 * Downloads receipt PDF for a retailer's full order summary.
 */
export function downloadRetailerReceiptPdf(order: OrderSummary): void {
  const data: ReceiptData = {
    orderId: order.id,
    orderCreatedAt: order.createdAt,
    orderStatus: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    fulfilmentMethod: order.fulfilmentMethod,
    pickupToken: order.pickupToken,
    grandTotal: order.subtotal,
    retailer: order.retailer,
    transport: order.transport,
    subOrders: order.subOrders,
    isWholesalerView: false,
  };

  triggerReceiptPdf(data);
}
