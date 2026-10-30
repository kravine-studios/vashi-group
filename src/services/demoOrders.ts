import type { AccountProfile, Product } from '../types';
import type { WholesalerDirectoryEntry } from '../catalog/CatalogContext';
import { releaseDemoTransportSlot, reserveDemoTransportSlot } from './transportSlots';
import { addDemoNotification } from './demoNotifications';

export type OrderLine = {
  productId: string;
  name: string;
  category: string;
  grade?: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type OrderSubOrder = {
  id: string;
  wholesalerId: string;
  wholesalerName: string;
  status: OrderSummary['status'];
  amount: number;
  wholesalerShopNumber: string | null;
  wholesalerContactName: string | null;
  wholesalerContactPhone: string | null;
  items: OrderLine[];
};

export type OrderTransport = {
  id: string;
  startsAt: string;
  endsAt: string;
  driverName: string;
  contactNumber: string;
};

export type OrderContact = {
  businessName: string;
  shopNumber: string;
  contactName: string;
  contactPhone: string;
};

export type OrderSummary = {
  id: string;
  createdAt: string;
  status: 'pending_payment' | 'placed' | 'confirmed' | 'expired' | 'cancelled' | 'completed';
  paymentMethod: 'online' | 'cod';
  paymentStatus: 'pending' | 'pending_cod' | 'paid' | 'failed' | 'refunded';
  fulfilmentMethod: 'truck_slot' | 'self_pickup';
  subtotal: number;
  pickupToken: string | null;
  reservationExpiresAt: string | null;
  retailer: OrderContact;
  transport: OrderTransport | null;
  subOrders: OrderSubOrder[];
};

export type IncomingSubOrder = {
  orderId: string;
  orderCreatedAt: string;
  orderStatus: OrderSummary['status'];
  paymentMethod: OrderSummary['paymentMethod'];
  paymentStatus: OrderSummary['paymentStatus'];
  fulfilmentMethod: OrderSummary['fulfilmentMethod'];
  pickupToken: string | null;
  subtotal: number;
  retailer: OrderContact;
  transport: OrderTransport | null;
  subOrder: OrderSubOrder;
};

export type PickupVerification = {
  orderId: string;
  subOrderId: string;
  retailer: OrderContact;
  amount: number;
  paymentMethod: OrderSummary['paymentMethod'];
  paymentStatus: OrderSummary['paymentStatus'];
  orderStatus: OrderSummary['status'];
  subOrderStatus: OrderSummary['status'];
};

const demoProductsKey = 'kirana-demo-products';
const demoOrdersKey = 'kirana-demo-orders';
const demoOrderPrefix = `${demoOrdersKey}:`;

function readOrders(retailerId: string): OrderSummary[] {
  const saved = localStorage.getItem(`${demoOrdersKey}:${retailerId}`);
  if (!saved) return [];
  const parsed: unknown = JSON.parse(saved);
  if (!Array.isArray(parsed)) throw new Error('Saved demo orders are invalid. Clear this browser storage key to continue.');
  return (parsed as OrderSummary[]).map((order) => ({
    ...order,
    retailer: order.retailer ?? {
      businessName: 'Retailer',
      shopNumber: '',
      contactName: '',
      contactPhone: '',
    },
    transport: order.transport ?? null,
    subOrders: (order.subOrders ?? []).map((subOrder) => ({
      ...subOrder,
      status: subOrder.status ?? order.status,
      wholesalerShopNumber: subOrder.wholesalerShopNumber ?? null,
      wholesalerContactName: subOrder.wholesalerContactName ?? null,
      wholesalerContactPhone: subOrder.wholesalerContactPhone ?? null,
    })),
  }));
}

function saveOrders(retailerId: string, orders: OrderSummary[]) {
  localStorage.setItem(`${demoOrdersKey}:${retailerId}`, JSON.stringify(orders));
}

function makePickupToken(orders: OrderSummary[]) {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    const token = `KR-${[...bytes].map((byte) => alphabet[byte % alphabet.length]).join('')}`;
    if (!orders.some((order) => order.pickupToken === token)) return token;
  }
}

function releaseExpiredOrders(retailerId: string, orders: OrderSummary[]) {
  const now = Date.now();
  const expired = orders.filter((order) =>
    order.status === 'pending_payment'
    && order.reservationExpiresAt
    && Date.parse(order.reservationExpiresAt) <= now,
  );
  if (!expired.length) return { orders, stockReleased: false };

  for (const order of expired) {
    if (order.transport) releaseDemoTransportSlot(order.transport.id);
  }

  const expiredIds = new Set(expired.map((order) => order.id));
  const updatedOrders = orders.map((order) => expiredIds.has(order.id)
    ? {
      ...order,
      status: 'expired' as const,
      paymentStatus: 'failed' as const,
      subOrders: order.subOrders.map((subOrder) => ({ ...subOrder, status: 'expired' as const })),
    }
    : order);
  saveOrders(retailerId, updatedOrders);
  return { orders: updatedOrders, stockReleased: true };
}

export function listDemoOrders(retailerId: string) {
  const orders = readOrders(retailerId);
  const released = releaseExpiredOrders(retailerId, orders);
  return {
    orders: released.orders.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    stockReleased: released.stockReleased,
  };
}

export function createDemoOrder(
  account: AccountProfile,
  products: Product[],
  cartLines: { productId: string; quantity: number }[],
  paymentMethod: 'online' | 'cod',
  fulfilmentMethod: 'truck_slot' | 'self_pickup',
  codOrderCap: number,
  transportSlotId?: string,
  wholesalers: WholesalerDirectoryEntry[] = [],
): OrderSummary {
  if (account.role !== 'retailer' || account.status !== 'approved' || !account.profileCompleted) {
    throw new Error('An approved retailer with a completed profile is required to place an order.');
  }
  if (!cartLines.length) throw new Error('Add at least one product to your cart.');
  if (fulfilmentMethod === 'truck_slot' && !transportSlotId) throw new Error('Choose an available truck slot.');
  if (new Set(cartLines.map((line) => line.productId)).size !== cartLines.length) {
    throw new Error('Your cart contains a duplicate product. Remove and add it again before checkout.');
  }

  const { orders } = releaseExpiredOrders(account.id, readOrders(account.id));
  const savedProducts = localStorage.getItem(demoProductsKey);
  const currentProducts = savedProducts ? JSON.parse(savedProducts) as Product[] : products;
  const lines: OrderLine[] = cartLines.map(({ productId, quantity }) => {
    const product = currentProducts.find((item) => item.id === productId);
    if (!product || !product.isActive || quantity < product.minOrder || quantity > product.stock) {
      throw new Error('A product is unavailable or its stock or minimum order has changed. Review your cart.');
    }
    return {
      productId: product.id,
      name: product.name,
      category: product.category,
      grade: product.grade ?? 'Standard',
      unit: product.unit,
      unitPrice: product.price,
      quantity,
      lineTotal: product.price * quantity,
    };
  });
  const subtotal = lines.reduce((total, line) => total + line.lineTotal, 0);
  if (paymentMethod === 'cod' && subtotal > codOrderCap) {
    throw new Error(`COD orders are currently limited to ₹${codOrderCap.toLocaleString('en-IN')}.`);
  }

  const sellerMap = new Map<string, OrderSubOrder>();
  for (const line of lines) {
    const product = currentProducts.find((item) => item.id === line.productId);
    if (!product) throw new Error('A product is no longer available. Review your cart.');
    const existing = sellerMap.get(product.wholesalerId);
    if (existing) {
      existing.items.push(line);
      existing.amount += line.lineTotal;
    } else {
      sellerMap.set(product.wholesalerId, {
        id: crypto.randomUUID(),
        wholesalerId: product.wholesalerId,
        wholesalerName: product.wholesalerName,
        status: paymentMethod === 'cod' ? 'placed' : 'pending_payment',
        amount: line.lineTotal,
        wholesalerShopNumber: wholesalers.find((seller) => seller.id === product.wholesalerId)?.shopNumber ?? null,
        wholesalerContactName: wholesalers.find((seller) => seller.id === product.wholesalerId)?.contactName ?? null,
        wholesalerContactPhone: wholesalers.find((seller) => seller.id === product.wholesalerId)?.contactPhone ?? null,
        items: [line],
      });
    }
  }

  const reservedSlot = fulfilmentMethod === 'truck_slot' && transportSlotId
    ? reserveDemoTransportSlot(transportSlotId)
    : null;
  const createdAt = new Date().toISOString();
  const order: OrderSummary = {
    id: crypto.randomUUID(),
    createdAt,
    status: paymentMethod === 'cod' ? 'placed' : 'pending_payment',
    paymentMethod,
    paymentStatus: paymentMethod === 'cod' ? 'pending_cod' : 'pending',
    fulfilmentMethod,
    subtotal,
    pickupToken: makePickupToken(orders),
    reservationExpiresAt: paymentMethod === 'online'
      ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
      : null,
    retailer: {
      businessName: account.businessName,
      shopNumber: account.shopNumber,
      contactName: account.contactName,
      contactPhone: account.contactPhone,
    },
    transport: reservedSlot ? {
      id: reservedSlot.id,
      startsAt: reservedSlot.startsAt,
      endsAt: reservedSlot.endsAt,
      driverName: reservedSlot.driverName,
      contactNumber: reservedSlot.contactNumber,
    } : null,
    subOrders: [...sellerMap.values()],
  };

  // NOTE: Inventory is NOT deducted at order placement time; it stays the same until wholesaler confirms pickup.
  try {
    saveOrders(account.id, [order, ...orders]);
  } catch (saveError) {
    if (reservedSlot) releaseDemoTransportSlot(reservedSlot.id);
    throw saveError;
  }

  // 1. Notify wholesalers
  for (const subOrder of order.subOrders) {
    addDemoNotification(
      subOrder.wholesalerId,
      'new_order',
      'New order received',
      `${account.businessName}, Shop ${account.shopNumber} has placed an order of ₹${subOrder.amount.toLocaleString('en-IN')}. Pickup confirmation required before release.`,
      { order_id: order.id, sub_order_id: subOrder.id },
    );
    if (order.transport) {
      addDemoNotification(
        subOrder.wholesalerId,
        'transport_slot_booked',
        'Truck slot booked',
        `${account.businessName} booked ${new Date(order.transport.startsAt).toLocaleString('en-IN')} with ${order.transport.driverName} (${order.transport.contactNumber}).`,
        { order_id: order.id, slot_id: order.transport.id },
      );
    }
  }

  // 2. Notify admin when order is placed by retailer
  addDemoNotification(
    'demo-admin',
    'order_placed',
    'New wholesale order placed',
    `Retailer ${account.businessName} has placed order #${order.id.slice(0, 8).toUpperCase()} for ₹${order.subtotal.toLocaleString('en-IN')} (${order.fulfilmentMethod === 'truck_slot' ? 'Truck Delivery' : 'Self-Pickup'}).`,
    { order_id: order.id, retailer_id: account.id },
  );

  if (order.transport) {
    addDemoNotification('demo-admin', 'transport_slot_booked', 'Transport slot booked', `A truck slot was booked for order ${order.id.slice(0, 8).toUpperCase()}.`, { order_id: order.id });
    addDemoNotification(account.id, 'transport_slot_booked', 'Truck slot booked', `Your slot is ${new Date(order.transport.startsAt).toLocaleString('en-IN')} with ${order.transport.driverName} (${order.transport.contactNumber}).`, { order_id: order.id });
  }
  return order;
}

export function completeDemoPayment(retailerId: string, orderId: string, succeeded: boolean): OrderSummary {
  const orders = readOrders(retailerId);
  const order = orders.find((candidate) => candidate.id === orderId);
  if (!order || order.paymentMethod !== 'online') {
    throw new Error('The online order was not found.');
  }
  if (order.status !== 'pending_payment') return order;
  const reservationActive = Boolean(
    order.reservationExpiresAt && Date.parse(order.reservationExpiresAt) > Date.now(),
  );
  const paymentCompleted = succeeded && reservationActive;

  if (!paymentCompleted) {
    if (order.transport) releaseDemoTransportSlot(order.transport.id);
  }

  const updatedOrder: OrderSummary = {
    ...order,
    status: paymentCompleted ? 'placed' : 'expired',
    paymentStatus: paymentCompleted ? 'paid' : 'failed',
    reservationExpiresAt: null,
    subOrders: order.subOrders.map((subOrder) => ({
      ...subOrder,
      status: paymentCompleted ? 'placed' : 'expired',
    })),
  };
  saveOrders(retailerId, orders.map((candidate) => candidate.id === orderId ? updatedOrder : candidate));
  addDemoNotification(
    retailerId,
    'order_status_changed',
    'Order status updated',
    `Your order status is now ${updatedOrder.status.replace('_', ' ')}.`,
    { order_id: orderId, status: updatedOrder.status },
  );

  // Send separate notification to admin when online order payment is completed & placed
  if (paymentCompleted) {
    addDemoNotification(
      'demo-admin',
      'order_placed',
      'New wholesale order paid & placed',
      `Payment received for order #${order.id.slice(0, 8).toUpperCase()} (₹${order.subtotal.toLocaleString('en-IN')}) from ${order.retailer.businessName}.`,
      { order_id: order.id, retailer_id: retailerId },
    );
  }

  return updatedOrder;
}

export function listDemoSellerOrders(wholesalerId: string): IncomingSubOrder[] {
  const retailerIds: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(demoOrderPrefix)) retailerIds.push(key.slice(demoOrderPrefix.length));
  }
  return retailerIds.flatMap((retailerId) => {
    const { orders } = listDemoOrders(retailerId);
    return orders.flatMap((order) => order.subOrders
      .filter((subOrder) => subOrder.wholesalerId === wholesalerId)
      .map((subOrder) => ({
        orderId: order.id,
        orderCreatedAt: order.createdAt,
        orderStatus: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        fulfilmentMethod: order.fulfilmentMethod,
        pickupToken: order.pickupToken,
        subtotal: order.subtotal,
        retailer: order.retailer,
        transport: order.transport,
        subOrder,
      })));
  }).sort((left, right) => right.orderCreatedAt.localeCompare(left.orderCreatedAt));
}

export function verifyDemoPickupToken(
  wholesalerId: string,
  token: string,
): PickupVerification {
  const order = listDemoSellerOrders(wholesalerId).find((candidate) =>
    candidate.fulfilmentMethod === 'self_pickup'
    && candidate.pickupToken?.toUpperCase() === token.trim().toUpperCase()
    && candidate.orderStatus !== 'expired'
    && candidate.orderStatus !== 'cancelled',
  );
  if (!order) throw new Error('No active self-pickup order with that token is assigned to your shop.');
  return {
    orderId: order.orderId,
    subOrderId: order.subOrder.id,
    retailer: order.retailer,
    amount: order.subOrder.amount,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
    subOrderStatus: order.subOrder.status,
  };
}

/**
 * Confirms that goods pickup has been done by retailer/driver.
 * 1. Updates sub-order status from 'placed' to 'confirmed'.
 * 2. Updates main order status to 'confirmed' if all sub-orders are confirmed.
 * 3. DEDUCTS product inventory from storage at this exact pickup moment.
 * 4. Sends separate notifications to admin and retailer.
 */
export function confirmDemoSubOrderPickup(
  wholesalerId: string,
  orderId: string,
  subOrderId: string,
): { order: OrderSummary; subOrder: OrderSubOrder } {
  let targetRetailerId = '';
  let targetOrder: OrderSummary | null = null;
  let targetSubOrder: OrderSubOrder | null = null;
  let targetOrders: OrderSummary[] = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(demoOrderPrefix)) {
      const retailerId = key.slice(demoOrderPrefix.length);
      const orders = readOrders(retailerId);
      const order = orders.find((o) => o.id === orderId);
      if (order) {
        const sub = order.subOrders.find((s) => s.id === subOrderId && s.wholesalerId === wholesalerId);
        if (sub) {
          targetRetailerId = retailerId;
          targetOrder = order;
          targetSubOrder = sub;
          targetOrders = orders;
          break;
        }
      }
    }
  }

  if (!targetOrder || !targetSubOrder || !targetRetailerId) {
    throw new Error('Matching sub-order was not found for this wholesale stall.');
  }

  if (targetSubOrder.status === 'confirmed' || targetSubOrder.status === 'completed') {
    return { order: targetOrder, subOrder: targetSubOrder };
  }

  // 1. Mark sub-order as confirmed
  targetSubOrder.status = 'confirmed';

  // If COD, mark paid upon pickup
  if (targetOrder.paymentMethod === 'cod') {
    targetOrder.paymentStatus = 'paid';
  }

  // 2. If all sub-orders are confirmed, update the main order status as well
  const allConfirmed = targetOrder.subOrders.every((s) => s.status === 'confirmed' || s.status === 'completed');
  if (allConfirmed) {
    targetOrder.status = 'confirmed';
  }

  // 3. Deduct product stock from kirana-demo-products NOW (at time of pickup!)
  const savedProducts = localStorage.getItem(demoProductsKey);
  if (savedProducts) {
    try {
      const prods = JSON.parse(savedProducts) as Product[];
      const itemQtyMap = new Map(targetSubOrder.items.map((i) => [i.productId, i.quantity]));
      const updatedProds = prods.map((prod) => {
        const qty = itemQtyMap.get(prod.id) ?? 0;
        if (qty > 0) {
          return {
            ...prod,
            stock: Math.max(0, prod.stock - qty),
          };
        }
        return prod;
      });
      localStorage.setItem(demoProductsKey, JSON.stringify(updatedProds));
    } catch {
      // fallback
    }
  }

  // 4. Save updated orders back to storage
  saveOrders(targetRetailerId, targetOrders);

  // 5. Send separate notification to admin when pickup is done from wholesaler
  addDemoNotification(
    'demo-admin',
    'pickup_confirmed',
    'Order pickup completed',
    `Wholesaler ${targetSubOrder.wholesalerName} confirmed pickup of order #${targetOrder.id.slice(0, 8).toUpperCase()} (₹${targetSubOrder.amount.toLocaleString('en-IN')}) for ${targetOrder.retailer.businessName}.`,
    { order_id: targetOrder.id, sub_order_id: targetSubOrder.id },
  );

  // 6. Send notification to retailer
  addDemoNotification(
    targetRetailerId,
    'pickup_confirmed',
    'Goods picked up from stall',
    `Your goods from ${targetSubOrder.wholesalerName} for order #${targetOrder.id.slice(0, 8).toUpperCase()} have been confirmed and released.`,
    { order_id: targetOrder.id, sub_order_id: targetSubOrder.id },
  );

  return { order: targetOrder, subOrder: targetSubOrder };
}
