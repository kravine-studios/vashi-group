import type { AccountStatus, Role } from '../types';

type TableShape<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type ProfileRow = {
  id: string;
  email: string;
  role: Role;
  status: AccountStatus;
  profile_completed: boolean;
  rejection_reason: string | null;
  approval_notice_pending: boolean;
  created_at: string;
  updated_at: string;
};

export type BusinessProfileRow = {
  user_id: string;
  business_name: string;
  address: string;
  gst_number: string;
  fssai_number: string;
  shop_number: string;
  contact_name: string;
  contact_phone: string;
  logo_path: string | null;
  created_at: string;
  updated_at: string;
};

type ProductRow = {
  id: string;
  wholesaler_id: string;
  name: string;
  category: string;
  grade: 'A' | 'B' | 'C';
  unit: 'kg' | '25kg' | 'ton';
  price: number;
  stock: number;
  min_order: number;
  is_active: boolean;
  photos: string[];
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: TableShape<ProfileRow, Omit<ProfileRow, 'created_at' | 'updated_at'>>;
      business_profiles: TableShape<BusinessProfileRow, Omit<BusinessProfileRow, 'created_at' | 'updated_at'>>;
      bank_details: TableShape<{
        user_id: string;
        account_holder: string;
        account_number: string;
        ifsc: string;
        created_at: string;
        updated_at: string;
      }, {
        user_id: string;
        account_holder: string;
        account_number: string;
        ifsc: string;
      }>;
      audit_logs: TableShape<{
        id: number;
        actor_id: string | null;
        subject_id: string | null;
        action: string;
        details: Record<string, unknown>;
        created_at: string;
      }, {
        id?: never;
        actor_id?: string | null;
        subject_id?: string | null;
        action: string;
        details?: Record<string, unknown>;
        created_at?: string;
      }>;
      product_categories: TableShape<{ name: string; active: boolean; gst_rate: number }, { name: string; active?: boolean; gst_rate?: number }>;
      product_grades: TableShape<{ name: 'A' | 'B' | 'C'; active: boolean }, { name: 'A' | 'B' | 'C'; active?: boolean }>;
      product_units: TableShape<{ name: 'kg' | '25kg' | 'ton'; active: boolean }, { name: 'kg' | '25kg' | 'ton'; active?: boolean }>;
      products: TableShape<ProductRow, Omit<ProductRow, 'id' | 'created_at' | 'updated_at'>>;
      app_settings: TableShape<{
        key: string;
        value: unknown;
        updated_at: string;
      }, { key: string; value: unknown; updated_at?: string }>;
      carts: TableShape<{
        id: string;
        retailer_id: string;
        created_at: string;
        updated_at: string;
      }, { id?: string; retailer_id: string; created_at?: string; updated_at?: string }>;
      cart_items: TableShape<{
        id: string;
        cart_id: string;
        product_id: string;
        quantity: number;
        created_at: string;
        updated_at: string;
      }, { id?: string; cart_id: string; product_id: string; quantity: number; created_at?: string; updated_at?: string }>;
      transport_slots: TableShape<{
        id: string;
        starts_at: string;
        ends_at: string;
        driver_name: string;
        contact_number: string;
        status: 'available' | 'booked' | 'unavailable';
        capacity: number;
        reserved_count: number;
        created_at: string;
        updated_at: string;
      }, {
        id?: string;
        starts_at: string;
        ends_at: string;
        driver_name: string;
        contact_number: string;
        status?: 'available' | 'booked' | 'unavailable';
        capacity?: number;
        reserved_count?: number;
        created_at?: string;
        updated_at?: string;
      }>;
      orders: TableShape<{
        id: string;
        retailer_id: string;
        payment_method: 'online' | 'cod';
        payment_status: 'pending' | 'pending_cod' | 'paid' | 'failed' | 'refunded';
        fulfilment_method: 'truck_slot' | 'self_pickup';
        status: 'pending_payment' | 'confirmed' | 'expired' | 'cancelled' | 'completed';
        pickup_token: string | null;
        transport_slot_id: string | null;
        subtotal: number;
        reservation_expires_at: string | null;
        created_at: string;
        updated_at: string;
      }, {
        id?: string;
        retailer_id: string;
        payment_method: 'online' | 'cod';
        payment_status: 'pending' | 'pending_cod' | 'paid' | 'failed' | 'refunded';
        fulfilment_method: 'truck_slot' | 'self_pickup';
        status: 'pending_payment' | 'confirmed' | 'expired' | 'cancelled' | 'completed';
        pickup_token?: string | null;
        transport_slot_id?: string | null;
        subtotal: number;
        reservation_expires_at?: string | null;
        created_at?: string;
        updated_at?: string;
      }>;
      sub_orders: TableShape<{
        id: string;
        order_id: string;
        wholesaler_id: string;
        status: 'pending_payment' | 'confirmed' | 'expired' | 'cancelled' | 'completed';
        amount: number;
        created_at: string;
        updated_at: string;
      }, {
        id?: string;
        order_id: string;
        wholesaler_id: string;
        status?: 'pending_payment' | 'confirmed' | 'expired' | 'cancelled' | 'completed';
        amount: number;
        created_at?: string;
        updated_at?: string;
      }>;
      sub_order_items: TableShape<{
        id: string;
        sub_order_id: string;
        product_id: string | null;
        product_name: string;
        category: string;
        grade: string;
        unit: string;
        unit_price: number;
        quantity: number;
        line_total: number;
        created_at: string;
      }, {
        id?: string;
        sub_order_id: string;
        product_id: string | null;
        product_name: string;
        category: string;
        grade: string;
        unit: string;
        unit_price: number;
        quantity: number;
        line_total: number;
        created_at?: string;
      }>;
      transport_bookings: TableShape<{
        id: string;
        order_id: string;
        slot_id: string;
        created_at: string;
      }, { id?: string; order_id: string; slot_id: string; created_at?: string }>;
      payments: TableShape<{
        id: string;
        order_id: string;
        provider: 'mock';
        provider_order_id: string;
        provider_payment_id: string | null;
        amount: number;
        currency: 'INR';
        status: 'pending' | 'paid' | 'failed' | 'refunded';
        paid_at: string | null;
        created_at: string;
        updated_at: string;
      }, {
        id?: string;
        order_id: string;
        provider?: 'mock';
        provider_order_id: string;
        provider_payment_id?: string | null;
        amount: number;
        currency?: 'INR';
        status?: 'pending' | 'paid' | 'failed' | 'refunded';
        paid_at?: string | null;
        created_at?: string;
        updated_at?: string;
      }>;
      payment_events: TableShape<{
        id: string;
        provider: 'mock';
        event_id: string;
        event_type: string;
        order_id: string;
        payment_id: string | null;
        payload: unknown;
        processed_at: string;
        created_at: string;
      }, {
        id?: string;
        provider?: 'mock';
        event_id: string;
        event_type: string;
        order_id: string;
        payment_id?: string | null;
        payload?: unknown;
        processed_at?: string;
        created_at?: string;
      }>;
      payouts: TableShape<{
        id: string;
        sub_order_id: string;
        wholesaler_id: string;
        amount: number;
        status: 'held' | 'released' | 'cancelled';
        provider_transfer_id: string | null;
        released_at: string | null;
        created_at: string;
        updated_at: string;
      }, {
        id?: string;
        sub_order_id: string;
        wholesaler_id: string;
        amount: number;
        status?: 'held' | 'released' | 'cancelled';
        provider_transfer_id?: string | null;
        released_at?: string | null;
        created_at?: string;
        updated_at?: string;
      }>;
      disputes: TableShape<{
        id: string;
        order_id: string;
        sub_order_id: string | null;
        raised_by: string;
        reason: 'missing_items' | 'damaged_goods' | 'wrong_items' | 'quality_issue' | 'payment_issue' | 'other';
        description: string;
        photo_paths: string[];
        status: Database['public']['Enums']['dispute_status'];
        resolution: Database['public']['Enums']['dispute_resolution'] | null;
        resolution_notes: string | null;
        created_at: string;
        updated_at: string;
      }, {
        id?: string;
        order_id: string;
        sub_order_id?: string | null;
        raised_by: string;
        reason: 'missing_items' | 'damaged_goods' | 'wrong_items' | 'quality_issue' | 'payment_issue' | 'other';
        description: string;
        photo_paths?: string[];
        status?: Database['public']['Enums']['dispute_status'];
        resolution?: Database['public']['Enums']['dispute_resolution'] | null;
        resolution_notes?: string | null;
        created_at?: string;
        updated_at?: string;
      }>;
      dispute_messages: TableShape<{
        id: string;
        dispute_id: string;
        sender_id: string;
        message: string;
        created_at: string;
      }, {
        id?: string;
        dispute_id: string;
        sender_id: string;
        message: string;
        created_at?: string;
      }>;
      notifications: TableShape<{
        id: string;
        recipient_id: string;
        type: string;
        title: string;
        message: string;
        payload: Record<string, unknown>;
        read_at: string | null;
        created_at: string;
      }, {
        id?: string;
        recipient_id: string;
        type: string;
        title: string;
        message: string;
        payload?: Record<string, unknown>;
        read_at?: string | null;
        created_at?: string;
      }>;
    };
    Views: {
      wholesaler_directory: {
        Row: {
          id: string;
          business_name: string;
          address: string;
          shop_number: string;
          contact_name: string;
          contact_phone: string;
          logo_path: string | null;
        };
        Relationships: [];
      };
      wholesaler_order_details: {
        Row: {
          sub_order_id: string;
          order_id: string;
          wholesaler_id: string;
          sub_order_status: Database['public']['Enums']['order_status'];
          amount: number;
          sub_order_created_at: string;
          payment_method: Database['public']['Enums']['payment_method'];
          payment_status: Database['public']['Enums']['order_payment_status'];
          fulfilment_method: Database['public']['Enums']['fulfilment_method'];
          order_status: Database['public']['Enums']['order_status'];
          subtotal: number;
          transport_slot_id: string | null;
          order_created_at: string;
          retailer_business_name: string | null;
          retailer_shop_number: string | null;
          retailer_contact_name: string | null;
          retailer_contact_phone: string | null;
          transport_starts_at: string | null;
          transport_ends_at: string | null;
          transport_driver_name: string | null;
          transport_contact_number: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      review_registration: {
        Args: { target_user_id: string; approve: boolean; reason?: string | null };
        Returns: undefined;
      };
      complete_my_profile: {
        Args: {
          account_holder_input: string;
          account_number_input: string;
          ifsc_input: string;
          logo_path_input: string;
        };
        Returns: undefined;
      };
      consume_approval_notice: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      place_order: {
        Args: {
          cart_lines: { product_id: string; quantity: number }[];
          payment_method_input: 'online' | 'cod';
          fulfilment_method_input: 'truck_slot' | 'self_pickup';
          transport_slot_id_input?: string | null;
        };
        Returns: string;
      };
      release_expired_order_reservations: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      complete_mock_payment: {
        Args: {
          target_order_id: string;
          target_retailer_id: string;
          payment_succeeded: boolean;
          idempotency_key: string;
        };
        Returns: 'pending_payment' | 'confirmed' | 'expired' | 'cancelled' | 'completed';
      };
      can_read_order: {
        Args: { target_order_id: string };
        Returns: boolean;
      };
      can_read_sub_order: {
        Args: { target_sub_order_id: string };
        Returns: boolean;
      };
      admin_create_transport_slot: {
        Args: {
          starts_at_input: string;
          ends_at_input: string;
          driver_name_input: string;
          contact_number_input: string;
          capacity_input?: number | null;
        };
        Returns: string;
      };
      admin_bulk_create_transport_slots: {
        Args: {
          date_start_input: string;
          date_end_input: string;
          driver_name_input: string;
          contact_number_input: string;
          market_open_input?: string | null;
          market_close_input?: string | null;
          slot_length_minutes_input?: number | null;
          capacity_input?: number | null;
        };
        Returns: number;
      };
      admin_update_transport_slot: {
        Args: {
          slot_id_input: string;
          starts_at_input: string;
          ends_at_input: string;
          driver_name_input: string;
          contact_number_input: string;
          capacity_input: number;
        };
        Returns: undefined;
      };
      admin_set_transport_slot_unavailable: {
        Args: { slot_id_input: string; unavailable_input: boolean };
        Returns: undefined;
      };
      verify_pickup_token: {
        Args: { token_input: string };
        Returns: {
          order_id: string;
          sub_order_id: string;
          retailer_business_name: string | null;
          retailer_shop_number: string | null;
          retailer_contact_name: string | null;
          retailer_contact_phone: string | null;
          amount: number;
          payment_method: Database['public']['Enums']['payment_method'];
          payment_status: Database['public']['Enums']['order_payment_status'];
          order_status: Database['public']['Enums']['order_status'];
          sub_order_status: Database['public']['Enums']['order_status'];
        }[];
      };
      can_read_dispute: {
        Args: { target_dispute_id: string };
        Returns: boolean;
      };
      create_dispute: {
        Args: {
          order_id_input: string;
          sub_order_id_input: string | null;
          reason_input: string;
          description_input: string;
        };
        Returns: string;
      };
      add_dispute_message: {
        Args: { dispute_id_input: string; message_input: string };
        Returns: string;
      };
      attach_dispute_photos: {
        Args: { dispute_id_input: string; photo_paths_input: string[] };
        Returns: undefined;
      };
      admin_update_dispute: {
        Args: {
          dispute_id_input: string;
          status_input: Database['public']['Enums']['dispute_status'];
          resolution_input?: Database['public']['Enums']['dispute_resolution'] | null;
          resolution_notes_input?: string | null;
          message_input?: string | null;
        };
        Returns: undefined;
      };
      admin_set_account_status: {
        Args: {
          target_user_id: string;
          status_input: AccountStatus;
          reason_input?: string | null;
        };
        Returns: undefined;
      };
      admin_update_app_setting: {
        Args: {
          setting_key_input: string;
          setting_value_input: unknown;
        };
        Returns: undefined;
      };
      admin_update_category_gst_rate: {
        Args: { category_name_input: string; gst_rate_input: number };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: Role;
      account_status: AccountStatus;
      payment_method: 'online' | 'cod';
      fulfilment_method: 'truck_slot' | 'self_pickup';
      order_status: 'pending_payment' | 'confirmed' | 'expired' | 'cancelled' | 'completed';
      order_payment_status: 'pending' | 'pending_cod' | 'paid' | 'failed' | 'refunded';
      payment_record_status: 'pending' | 'paid' | 'failed' | 'refunded';
      payout_status: 'held' | 'released' | 'cancelled';
      dispute_status: 'open' | 'under_review' | 'resolved' | 'rejected';
      dispute_resolution: 'refund' | 'replacement' | 'dismissed';
    };
    CompositeTypes: Record<string, never>;
  };
};
