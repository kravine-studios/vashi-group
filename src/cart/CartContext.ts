import { createContext } from 'react';
import type { Product } from '../types';
import type { OrderSummary } from '../services/demoOrders';

export type CartEntry = {
  product: Product;
  quantity: number;
};

export type TransportSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  driverName: string;
  contactNumber: string;
  capacity: number;
  reservedCount: number;
};

export type CartContextValue = {
  items: CartEntry[];
  orders: OrderSummary[];
  slots: TransportSlot[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  itemCount: number;
  subtotal: number;
  codOrderCap: number;
  onlinePaymentAvailable: boolean;
  addToCart: (product: Product, quantity?: number) => Promise<void>;
  setQuantity: (product: Product, quantity: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  placeOrder: (
    paymentMethod: 'online' | 'cod',
    fulfilmentMethod: 'truck_slot' | 'self_pickup',
    transportSlotId?: string,
  ) => Promise<OrderSummary>;
  completeMockPayment: (orderId: string, succeeded: boolean) => Promise<OrderSummary>;
  refreshOrders: () => Promise<OrderSummary[]>;
  refreshSlots: () => Promise<void>;
};

export const CartContext = createContext<CartContextValue | null>(null);
