import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const paymentProviderValue = import.meta.env.VITE_PAYMENT_PROVIDER ?? 'mock';

if (paymentProviderValue !== 'mock') {
  throw new Error('VITE_PAYMENT_PROVIDER currently supports only "mock". No real payment gateway is connected.');
}

const paymentProvider = paymentProviderValue;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const codOrderCapValue = import.meta.env.VITE_COD_ORDER_CAP?.trim();
const codOrderCap = codOrderCapValue ? Number(codOrderCapValue) : 5000;
const profileCompletionValue = import.meta.env.VITE_PROFILE_COMPLETION_REQUIRED ?? 'true';

if (Boolean(supabaseUrl) !== Boolean(supabaseAnonKey)) {
  throw new Error('Set both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or leave both empty.');
}

if (!Number.isFinite(codOrderCap) || codOrderCap < 0) {
  throw new Error('VITE_COD_ORDER_CAP must be a non-negative number.');
}

if (profileCompletionValue !== 'true' && profileCompletionValue !== 'false') {
  throw new Error('VITE_PROFILE_COMPLETION_REQUIRED must be either "true" or "false".');
}

if (supabaseUrl) {
  try {
    new URL(supabaseUrl);
  } catch {
    throw new Error('VITE_SUPABASE_URL must be a valid URL.');
  }
}

export const appConfig = {
  appName: import.meta.env.VITE_APP_NAME?.trim() || 'Kirana B2B Marketplace',
  paymentProvider,
  supabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),
  codOrderCap,
  profileCompletionRequired: profileCompletionValue === 'true',
} as const;

export const supabase: SupabaseClient<Database> | null =
  supabaseUrl && supabaseAnonKey ? createClient<Database>(supabaseUrl, supabaseAnonKey) : null;
