import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/useAuth';
import { useCatalog } from '../catalog/useCatalog';
import { appConfig, supabase } from '../lib/env';
import { mockPaymentProvider } from '../payments/PaymentProvider';
import { completeDemoPayment as completeDemoOrderPayment, createDemoOrder, listDemoOrders, type OrderSummary } from '../services/demoOrders';
import { listAdminSettings } from '../services/adminOperations';
import { listAvailableDemoTransportSlots } from '../services/transportSlots';
import { CartContext, type CartEntry, type CartContextValue, type TransportSlot } from './CartContext';

const demoCartKey = 'kirana-demo-cart';

function readDemoCart(retailerId: string) {
  const saved = localStorage.getItem(`${demoCartKey}:${retailerId}`);
  if (!saved) return [] as { productId: string; quantity: number }[];
  const parsed: unknown = JSON.parse(saved);
  if (!Array.isArray(parsed)) throw new Error('Saved demo cart is invalid. Clear this browser storage key to continue.');
  return parsed as { productId: string; quantity: number }[];
}

function mapOrders(
  orders: {
    id: string;
    created_at: string;
    status: OrderSummary['status'];
    payment_method: OrderSummary['paymentMethod'];
    payment_status: OrderSummary['paymentStatus'];
    fulfilment_method: OrderSummary['fulfilmentMethod'];
    subtotal: number;
    pickup_token: string | null;
    reservation_expires_at: string | null;
  }[],
  subOrders: {
    id: string;
    order_id: string;
    wholesaler_id: string;
    status: OrderSummary['status'];
    amount: number;
  }[],
  orderItems: {
    sub_order_id: string;
    product_id: string | null;
    product_name: string;
    category: string;
    grade: string;
    unit: string;
    unit_price: number;
    quantity: number;
    line_total: number;
  }[],
  wholesalers: Map<string, { name: string; shopNumber: string | null; contactName: string; contactPhone: string }>,
  retailer: OrderSummary['retailer'],
  transportByOrder: Map<string, OrderSummary['transport']>,
): OrderSummary[] {
  const itemsBySubOrder = new Map<string, OrderSummary['subOrders'][number]['items']>();
  for (const item of orderItems) {
    const items = itemsBySubOrder.get(item.sub_order_id) ?? [];
    items.push({
      productId: item.product_id ?? '',
      name: item.product_name,
      category: item.category,
      grade: item.grade,
      unit: item.unit,
      unitPrice: Number(item.unit_price),
      quantity: Number(item.quantity),
      lineTotal: Number(item.line_total),
    });
    itemsBySubOrder.set(item.sub_order_id, items);
  }
  const subOrdersByOrder = new Map<string, OrderSummary['subOrders']>();
  for (const subOrder of subOrders) {
    const sellerOrders = subOrdersByOrder.get(subOrder.order_id) ?? [];
    sellerOrders.push({
      id: subOrder.id,
      wholesalerId: subOrder.wholesaler_id,
      wholesalerName: wholesalers.get(subOrder.wholesaler_id)?.name ?? 'Verified wholesaler',
      status: subOrder.status,
      amount: Number(subOrder.amount),
      wholesalerShopNumber: wholesalers.get(subOrder.wholesaler_id)?.shopNumber ?? null,
      wholesalerContactName: wholesalers.get(subOrder.wholesaler_id)?.contactName ?? null,
      wholesalerContactPhone: wholesalers.get(subOrder.wholesaler_id)?.contactPhone ?? null,
      items: itemsBySubOrder.get(subOrder.id) ?? [],
    });
    subOrdersByOrder.set(subOrder.order_id, sellerOrders);
  }
  return orders.map((order) => ({
    id: order.id,
    createdAt: order.created_at,
    status: order.status,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    fulfilmentMethod: order.fulfilment_method,
    subtotal: Number(order.subtotal),
    pickupToken: order.pickup_token,
    reservationExpiresAt: order.reservation_expires_at,
    retailer,
    transport: transportByOrder.get(order.id) ?? null,
    subOrders: (subOrdersByOrder.get(order.id) ?? []).sort((left, right) => left.wholesalerName.localeCompare(right.wholesalerName)),
  }));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const { products, wholesalers, refreshCatalog } = useCatalog();
  const [cartLines, setCartLines] = useState<{ productId: string; quantity: number }[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [slots, setSlots] = useState<TransportSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codOrderCap, setCodOrderCap] = useState(appConfig.codOrderCap);

  const loadCart = useCallback(async () => {
    if (!account || account.role !== 'retailer' || account.status !== 'approved' || !account.profileCompleted) {
      setCartLines([]);
      return;
    }
    if (!supabase) {
      setCartLines(readDemoCart(account.id));
      return;
    }
    const { data: existingCart, error: cartError } = await supabase
      .from('carts')
      .select('id')
      .eq('retailer_id', account.id)
      .maybeSingle();
    if (cartError) throw cartError;
    if (!existingCart) {
      setCartLines([]);
      return;
    }
    const { data, error: itemsError } = await supabase
      .from('cart_items')
      .select('product_id, quantity')
      .eq('cart_id', existingCart.id);
    if (itemsError) throw itemsError;
    setCartLines(data.map((item) => ({ productId: item.product_id, quantity: Number(item.quantity) })));
  }, [account]);

  const refreshOrders = useCallback(async () => {
    if (!account || account.role !== 'retailer' || account.status !== 'approved' || !account.profileCompleted) {
      setOrders([]);
      return [];
    }
    if (!supabase) {
      const demoOrderList = listDemoOrders(account.id);
      setOrders(demoOrderList.orders);
      if (demoOrderList.stockReleased) await refreshCatalog();
      return demoOrderList.orders;
    }
    const { data: orderRows, error: orderError } = await supabase
      .from('orders')
      .select('id, created_at, status, payment_method, payment_status, fulfilment_method, subtotal, pickup_token, reservation_expires_at')
      .eq('retailer_id', account.id)
      .order('created_at', { ascending: false });
    if (orderError) throw orderError;
    if (!orderRows.length) {
      setOrders([]);
      return [];
    }
    const orderIds = orderRows.map((order) => order.id);
    const { data: subOrderRows, error: subOrderError } = await supabase
      .from('sub_orders')
      .select('id, order_id, wholesaler_id, status, amount')
      .in('order_id', orderIds);
    if (subOrderError) throw subOrderError;
    const subOrderIds = subOrderRows.map((subOrder) => subOrder.id);
    const { data: itemRows, error: itemError } = subOrderIds.length
      ? await supabase
        .from('sub_order_items')
        .select('sub_order_id, product_id, product_name, category, grade, unit, unit_price, quantity, line_total')
        .in('sub_order_id', subOrderIds)
      : { data: [], error: null };
    if (itemError) throw itemError;
    const { data: bookingRows, error: bookingError } = await supabase
      .from('transport_bookings')
      .select('order_id, slot_id')
      .in('order_id', orderIds);
    if (bookingError) throw bookingError;
    const slotIds = bookingRows.map((booking) => booking.slot_id);
    const { data: slotRows, error: slotError } = slotIds.length
      ? await supabase
        .from('transport_slots')
        .select('id, starts_at, ends_at, driver_name, contact_number')
        .in('id', slotIds)
      : { data: [], error: null };
    if (slotError) throw slotError;
    const slotById = new Map(slotRows.map((slot) => [slot.id, {
      id: slot.id,
      startsAt: slot.starts_at,
      endsAt: slot.ends_at,
      driverName: slot.driver_name,
      contactNumber: slot.contact_number,
    }]));
    const transportByOrder = new Map(bookingRows.map((booking) => [
      booking.order_id,
      slotById.get(booking.slot_id) ?? null,
    ]));
    const sellerDirectory = new Map(wholesalers.map((seller) => [seller.id, {
      name: seller.name,
      shopNumber: seller.shopNumber,
      contactName: seller.contactName,
      contactPhone: seller.contactPhone,
    }]));
    const mappedOrders = mapOrders(orderRows, subOrderRows, itemRows, sellerDirectory, {
      businessName: account.businessName,
      shopNumber: account.shopNumber,
      contactName: account.contactName,
      contactPhone: account.contactPhone,
    }, transportByOrder);
    setOrders(mappedOrders);
    return mappedOrders;
  }, [account, refreshCatalog, wholesalers]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void Promise.all([loadCart(), refreshOrders()]).then(() => {
      if (active) setLoading(false);
    }).catch((loadError: unknown) => {
      if (active) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load your cart and orders.');
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [loadCart, refreshOrders]);

  const refreshSlots = useCallback(async () => {
    if (!account || account.role !== 'retailer' || account.status !== 'approved' || !account.profileCompleted) {
      setSlots([]);
      return;
    }
    if (!supabase) {
      const settings = new Map((await listAdminSettings()).map(({ key, value }) => [key, value]));
      const codCap = Number(settings.get('cod_order_cap'));
      if (!Number.isFinite(codCap) || codCap < 1) throw new Error('The COD order limit is not configured correctly.');
      setCodOrderCap(codCap);
      setSlots(listAvailableDemoTransportSlots().map((slot) => ({
        id: slot.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        driverName: slot.driverName,
        contactNumber: slot.contactNumber,
        capacity: slot.capacity,
        reservedCount: slot.reservedCount,
      })));
      return;
    }
    const [slotResult, capResult] = await Promise.all([
      supabase.from('transport_slots')
        .select('id, starts_at, ends_at, driver_name, contact_number, capacity, reserved_count')
        .eq('status', 'available')
        .gt('starts_at', new Date().toISOString())
        .order('starts_at'),
      supabase.from('app_settings').select('value').eq('key', 'cod_order_cap').maybeSingle(),
    ]);
    if (slotResult.error) throw slotResult.error;
    if (capResult.error) throw capResult.error;
    const cap = Number(capResult.data?.value);
    if (!Number.isFinite(cap) || cap < 0) throw new Error('The COD order limit is not configured correctly.');
    setCodOrderCap(cap);
    setSlots(slotResult.data.map((slot) => ({
      id: slot.id,
      startsAt: slot.starts_at,
      endsAt: slot.ends_at,
      driverName: slot.driver_name,
      contactNumber: slot.contact_number,
      capacity: slot.capacity,
      reservedCount: slot.reserved_count,
    })));
  }, [account]);

  useEffect(() => {
    let active = true;
    void refreshSlots().catch((slotError: unknown) => {
      if (active) setError(slotError instanceof Error ? slotError.message : 'Unable to load transport slots.');
    });
    return () => { active = false; };
  }, [refreshSlots]);

  const items = useMemo<CartEntry[]>(() => cartLines.flatMap((line) => {
    const product = products.find((candidate) => candidate.id === line.productId);
    return product ? [{ product, quantity: line.quantity }] : [];
  }), [cartLines, products]);

  const persistLines = useCallback(async (nextLines: { productId: string; quantity: number }[]) => {
    if (!account || account.role !== 'retailer') throw new Error('Sign in as a retailer to use the cart.');
    if (supabase) {
      const { data: cart, error: cartError } = await supabase
        .from('carts')
        .upsert({ retailer_id: account.id }, { onConflict: 'retailer_id' })
        .select('id')
        .single();
      if (cartError) throw cartError;
      const currentIds = cartLines.map((line) => line.productId);
      const nextIds = nextLines.map((line) => line.productId);
      const removedIds = currentIds.filter((id) => !nextIds.includes(id));
      if (removedIds.length) {
        const { error: deleteError } = await supabase
          .from('cart_items')
          .delete()
          .eq('cart_id', cart.id)
          .in('product_id', removedIds);
        if (deleteError) throw deleteError;
      }
      if (nextLines.length) {
        const { error: upsertError } = await supabase.from('cart_items').upsert(
          nextLines.map((line) => ({ cart_id: cart.id, product_id: line.productId, quantity: line.quantity })),
          { onConflict: 'cart_id,product_id' },
        );
        if (upsertError) throw upsertError;
      }
    } else {
      localStorage.setItem(`${demoCartKey}:${account.id}`, JSON.stringify(nextLines));
    }
    setCartLines(nextLines);
  }, [account, cartLines]);

  const addToCart = useCallback(async (product: CartEntry['product'], quantity = product.minOrder) => {
    if (!Number.isFinite(quantity) || quantity < product.minOrder || quantity > product.stock) {
      throw new Error(`Quantity must be between ${product.minOrder} and ${product.stock} ${product.unit}.`);
    }
    const existing = cartLines.find((line) => line.productId === product.id);
    const nextQuantity = existing ? existing.quantity + quantity : quantity;
    if (nextQuantity > product.stock) throw new Error(`Only ${product.stock} ${product.unit} are available.`);
    const nextLines = existing
      ? cartLines.map((line) => line.productId === product.id ? { ...line, quantity: nextQuantity } : line)
      : [...cartLines, { productId: product.id, quantity: nextQuantity }];
    await persistLines(nextLines);
  }, [cartLines, persistLines]);

  const setQuantity = useCallback(async (product: CartEntry['product'], quantity: number) => {
    if (quantity === 0) {
      await persistLines(cartLines.filter((line) => line.productId !== product.id));
      return;
    }
    if (!Number.isFinite(quantity) || quantity < product.minOrder || quantity > product.stock) {
      throw new Error(`Quantity must be between ${product.minOrder} and ${product.stock} ${product.unit}.`);
    }
    const nextLines = cartLines.some((line) => line.productId === product.id)
      ? cartLines.map((line) => line.productId === product.id ? { ...line, quantity } : line)
      : [...cartLines, { productId: product.id, quantity }];
    await persistLines(nextLines);
  }, [cartLines, persistLines]);

  const removeFromCart = useCallback(async (productId: string) => {
    await persistLines(cartLines.filter((line) => line.productId !== productId));
  }, [cartLines, persistLines]);

  const placeOrder = useCallback(async (
    paymentMethod: 'online' | 'cod',
    fulfilmentMethod: 'truck_slot' | 'self_pickup',
    transportSlotId?: string,
  ) => {
    if (!account || account.role !== 'retailer' || account.status !== 'approved' || !account.profileCompleted) {
      throw new Error('An approved retailer with a completed profile is required to place an order.');
    }
    if (!cartLines.length) throw new Error('Add at least one product to your cart.');
    if (fulfilmentMethod === 'truck_slot' && !transportSlotId) throw new Error('Choose an available truck slot.');
    setSaving(true);
    setError(null);
    try {
      let createdOrder: OrderSummary;
      if (supabase) {
        const { data: orderId, error: orderError } = await supabase.rpc('place_order', {
          cart_lines: cartLines.map((line) => ({ product_id: line.productId, quantity: line.quantity })),
          payment_method_input: paymentMethod,
          fulfilment_method_input: fulfilmentMethod,
          transport_slot_id_input: transportSlotId ?? null,
        });
        if (orderError) throw orderError;
        await refreshCatalog();
        await loadCart();
        const refreshedOrders = await refreshOrders();
        const savedOrder = refreshedOrders.find((order) => order.id === orderId);
        if (savedOrder) createdOrder = savedOrder;
        else {
          const { data, error: savedOrderError } = await supabase
            .from('orders')
            .select('id, created_at, status, payment_method, payment_status, fulfilment_method, subtotal, pickup_token, reservation_expires_at')
            .eq('id', orderId)
            .single();
          if (savedOrderError) throw savedOrderError;
          createdOrder = {
            id: data.id,
            createdAt: data.created_at,
            status: data.status,
            paymentMethod: data.payment_method,
            paymentStatus: data.payment_status,
            fulfilmentMethod: data.fulfilment_method,
            subtotal: Number(data.subtotal),
            pickupToken: data.pickup_token,
            reservationExpiresAt: data.reservation_expires_at,
            retailer: {
              businessName: account.businessName,
              shopNumber: account.shopNumber,
              contactName: account.contactName,
              contactPhone: account.contactPhone,
            },
            transport: null,
            subOrders: [],
          };
        }
      } else {
        createdOrder = createDemoOrder(
          account,
          products,
          cartLines,
          paymentMethod,
          fulfilmentMethod,
          codOrderCap,
          transportSlotId,
          wholesalers,
        );
        localStorage.setItem(`${demoCartKey}:${account.id}`, '[]');
        setCartLines([]);
        await refreshCatalog();
        await refreshOrders();
      }
      await refreshSlots();
      return createdOrder;
    } catch (orderError) {
      const message = orderError instanceof Error ? orderError.message : 'Unable to place this order.';
      setError(message);
      throw new Error(message);
    } finally {
      setSaving(false);
    }
  }, [account, cartLines, codOrderCap, loadCart, products, refreshCatalog, refreshOrders, refreshSlots, wholesalers]);

  const completeMockPayment = useCallback(async (orderId: string, succeeded: boolean) => {
    if (!account || account.role !== 'retailer' || account.status !== 'approved' || !account.profileCompleted) {
      throw new Error('An approved retailer with a completed profile is required to complete payment.');
    }
    setSaving(true);
    setError(null);
    try {
      if (!supabase) {
        const order = completeDemoOrderPayment(account.id, orderId, succeeded);
        await refreshCatalog();
        await refreshOrders();
        await refreshSlots();
        return order;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) throw new Error('Sign in again before completing this mock payment.');

      await mockPaymentProvider.completeMockPayment({
        accessToken: sessionData.session.access_token,
        orderId,
        outcome: succeeded ? 'paid' : 'failed',
        idempotencyKey: crypto.randomUUID(),
      });
      const refreshedOrders = await refreshOrders();
      await refreshCatalog();
      await refreshSlots();
      const order = refreshedOrders.find((candidate) => candidate.id === orderId);
      if (!order) throw new Error('Payment was recorded, but the updated order could not be loaded.');
      return order;
    } catch (paymentError) {
      const message = paymentError instanceof Error ? paymentError.message : 'Unable to complete the mock payment.';
      setError(message);
      throw new Error(message);
    } finally {
      setSaving(false);
    }
  }, [account, refreshCatalog, refreshOrders, refreshSlots]);

  const value = useMemo<CartContextValue>(() => ({
    items,
    orders,
    slots,
    loading,
    saving,
    error,
    itemCount: cartLines.reduce((total, line) => total + line.quantity, 0),
    subtotal: items.reduce((total, item) => total + item.product.price * item.quantity, 0),
    codOrderCap,
    onlinePaymentAvailable: appConfig.paymentProvider === 'mock',
    addToCart,
    setQuantity,
    removeFromCart,
    placeOrder,
    completeMockPayment,
    refreshOrders,
    refreshSlots,
  }), [items, orders, slots, loading, saving, error, cartLines, codOrderCap, addToCart, setQuantity, removeFromCart, placeOrder, completeMockPayment, refreshOrders, refreshSlots]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
