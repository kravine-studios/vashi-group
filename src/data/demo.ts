import type { NotificationItem, UserProfile } from '../types';
import { products } from './products';

export const currentUser: UserProfile = {
  name: 'Priya Shah',
  role: 'retailer',
  status: 'approved',
  businessName: 'Shah Kirana Mart',
};

export const notifications: NotificationItem[] = [
  { id: 'n1', title: 'Order packed', body: 'Your order from Vashi Grain House is packed and ready.', read: false },
  { id: 'n2', title: 'Approval', body: 'Your retailer account has been approved.', read: true },
  { id: 'n3', title: 'Transport slot booked', body: 'Pickup slot for 10:00–12:00 is confirmed.', read: false },
];

export const wholesalers = [
  { id: 'w-1', name: 'Vashi Grain House', type: 'wholesaler', location: 'Sector 19, Vashi' },
  { id: 'w-2', name: 'Kamal Agro', type: 'wholesaler', location: 'Airoli Road' },
  { id: 'w-3', name: 'Riverdale Foods', type: 'wholesaler', location: 'Belapur' },
];

export const catalog = products;
