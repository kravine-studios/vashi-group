export type Role = 'super_admin' | 'wholesaler' | 'retailer';
export type AccountStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type PaymentMode = 'online' | 'cod';
export type FulfilmentMode = 'truck_slot' | 'self_pickup';

export type Product = {
  id: string;
  name: string;
  category: string;
  grade: 'A' | 'B' | 'C';
  price: number;
  unit: 'kg' | '25kg' | 'ton';
  stock: number;
  minOrder: number;
  wholesalerId: string;
  wholesalerName: string;
  isActive: boolean;
  image: string;
  photos?: string[];
};

export type CartItem = {
  productId: string;
  quantity: number;
  product: Product;
};

export type UserProfile = {
  name: string;
  role: Role;
  status: AccountStatus;
  businessName: string;
};

export type AccountProfile = {
  id: string;
  email: string;
  role: Role;
  status: AccountStatus;
  profileCompleted: boolean;
  rejectionReason: string | null;
  approvalNoticePending: boolean;
  businessName: string;
  address: string;
  gstNumber: string;
  fssaiNumber: string;
  shopNumber: string;
  contactName: string;
  contactPhone: string;
  logoPath: string | null;
};

export type RegistrationDetails = {
  role: Exclude<Role, 'super_admin'>;
  businessName: string;
  address: string;
  gstNumber: string;
  fssaiNumber: string;
  shopNumber: string;
  contactName: string;
  contactPhone: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  read: boolean;
};
