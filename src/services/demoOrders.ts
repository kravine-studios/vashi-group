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
  status: 'pending_payment' | 'confirmed' | 'expired' | 'cancelled' | 'completed';
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

function releaseExpiredOrders(retailerId: string, orders: OrderSummary[], products: Product[]) {
  const now = Date.now();
  const expired = orders.filter((order) =>
    order.status === 'pending_payment'
    && order.reservationExpiresAt
    && Date.parse(order.reservationExpiresAt) <= now,
  );
  if (!expired.length) return { orders, stockReleased: false };

  const restoredQuantities = new Map<string, number>();
  for (const order of expired) {
    if (order.transport) releaseDemoTransportSlot(order.transport.id);
    for (const subOrder of order.subOrders) {
      for (const item of subOrder.items) {
        restoredQuantities.set(item.productId, (restoredQuantities.get(item.productId) ?? 0) + item.quantity);
      }
    }
  }
  const savedProducts = localStorage.getItem(demoProductsKey);
  const currentProducts = savedProducts ? JSON.parse(savedProducts) as Product[] : products;
  const restoredProducts = currentProducts.map((product) => ({
    ...product,
    stock: product.stock + (restoredQuantities.get(product.id) ?? 0),
  }));
  localStorage.setItem(demoProductsKey, JSON.stringify(restoredProducts));

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

export function listDemoOrders(retailerId: string, products: Product[]) {
  const orders = readOrders(retailerId);
  const released = releaseExpiredOrders(retailerId, orders, products);
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

  const { orders } = releaseExpiredOrders(account.id, readOrders(account.id), products);
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
        status: paymentMethod === 'cod' ? 'confirmed' : 'pending_payment',
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
    status: paymentMethod === 'cod' ? 'confirmed' : 'pending_payment',
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

  const quantities = new Map(cartLines.map((line) => [line.productId, line.quantity]));
  const updatedProducts = currentProducts.map((product) => ({
    ...product,
    stock: product.stock - (quantities.get(product.id) ?? 0),
  }));
  try {
    localStorage.setItem(demoProductsKey, JSON.stringify(updatedProducts));
    saveOrders(account.id, [order, ...orders]);
  } catch (saveError) {
    if (reservedSlot) releaseDemoTransportSlot(reservedSlot.id);
    if (savedProducts) localStorage.setItem(demoProductsKey, savedProducts);
    else localStorage.removeItem(demoProductsKey);
    throw saveError;
  }
  for (const subOrder of order.subOrders) {
    addDemoNotification(
      subOrder.wholesalerId,
      'new_order',
      'New order received',
      `${account.businessName}, Shop ${account.shopNumber} has placed an order of ₹${subOrder.amount.toLocaleString('en-IN')}.`,
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
    const savedProducts = localStorage.getItem(demoProductsKey);
    if (!savedProducts) throw new Error('Product stock could not be restored for the failed demo payment.');
    const products = JSON.parse(savedProducts) as Product[];
    const restoredQuantities = new Map<string, number>();
    for (const subOrder of order.subOrders) {
      for (const item of subOrder.items) {
        restoredQuantities.set(item.productId, (restoredQuantities.get(item.productId) ?? 0) + item.quantity);
      }
    }
    localStorage.setItem(demoProductsKey, JSON.stringify(products.map((product) => ({
      ...product,
      stock: product.stock + (restoredQuantities.get(product.id) ?? 0),
    }))));
    if (order.transport) releaseDemoTransportSlot(order.transport.id);
  }

  const updatedOrder: OrderSummary = {
    ...order,
    status: paymentCompleted ? 'confirmed' : 'expired',
    paymentStatus: paymentCompleted ? 'paid' : 'failed',
    reservationExpiresAt: null,
    subOrders: order.subOrders.map((subOrder) => ({
      ...subOrder,
      status: paymentCompleted ? 'confirmed' : 'expired',
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
  return updatedOrder;
}

export function listDemoSellerOrders(wholesalerId: string, products: Product[]): IncomingSubOrder[] {
  const retailerIds: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(demoOrderPrefix)) retailerIds.push(key.slice(demoOrderPrefix.length));
  }
  return retailerIds.flatMap((retailerId) => {
    const { orders } = listDemoOrders(retailerId, products);
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
  products: Product[],
): PickupVerification {
  const order = listDemoSellerOrders(wholesalerId, products).find((candidate) =>
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
