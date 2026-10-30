import { supabase } from '../lib/env';
import type { AccountStatus, Role } from '../types';
import type { OrderSummary } from './demoOrders';
import { demoSession } from './demoAuth';
import { categories, grades, units } from '../data/masters';

export type AdminOrder = {
  id: string;
  createdAt: string;
  retailerId: string;
  retailerName: string;
  status: OrderSummary['status'];
  paymentMethod: OrderSummary['paymentMethod'];
  paymentStatus: OrderSummary['paymentStatus'];
  fulfilmentMethod: OrderSummary['fulfilmentMethod'];
  subtotal: number;
  subOrders: { id: string; wholesalerName: string; status: OrderSummary['status']; amount: number }[];
};

export type AdminAccount = {
  id: string;
  email: string;
  role: Role;
  status: AccountStatus;
  businessName: string;
  shopNumber: string | null;
  gstNumber: string;
  fssaiNumber: string;
  contactName: string;
  contactPhone: string;
  createdAt: string;
};

export type AdminSettingKey =
  | 'cod_order_cap'
  | 'slot_default_capacity'
  | 'slot_publish_days_ahead'
  | 'slot_length_minutes'
  | 'market_open_time'
  | 'market_close_time';

export type AdminNumericSettingKey = Exclude<AdminSettingKey, 'market_open_time' | 'market_close_time'>;
export type AdminSetting =
  | { key: 'cod_order_cap'; value: number }
  | { key: 'slot_default_capacity'; value: number }
  | { key: 'slot_publish_days_ahead'; value: number }
  | { key: 'slot_length_minutes'; value: number }
  | { key: 'market_open_time' | 'market_close_time'; value: string };

export type AdminAuditEntry = {
  id: string;
  actor: string;
  subject: string;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
};

export type AdminMasterData = {
  categories: { name: string; active: boolean; gstRate: number }[];
  grades: { name: string; active: boolean }[];
  units: { name: string; active: boolean }[];
};

const demoSettingsKey = 'kirana-demo-admin-settings';
const demoCategoryRatesKey = 'kirana-demo-category-gst-rates';
const defaultSettings: AdminSetting[] = [
  { key: 'cod_order_cap', value: 5000 },
  { key: 'slot_default_capacity', value: 1 },
  { key: 'slot_publish_days_ahead', value: 3 },
  { key: 'slot_length_minutes', value: 60 },
  { key: 'market_open_time', value: '10:00' },
  { key: 'market_close_time', value: '18:00' },
];

const adminSettingKeys = defaultSettings.map(({ key }) => key);

function listDemoOrders(offset = 0): AdminOrder[] {
  const accounts = demoSession.listAccounts();
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const orders: AdminOrder[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith('kirana-demo-orders:')) continue;
    const retailerId = key.slice('kirana-demo-orders:'.length);
    const saved = localStorage.getItem(key);
    if (!saved) continue;
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) throw new Error('Saved demo orders are invalid.');
    for (const order of parsed as OrderSummary[]) {
      orders.push({
        id: order.id,
        createdAt: order.createdAt,
        retailerId,
        retailerName: accountsById.get(retailerId)?.businessName ?? order.retailer?.businessName ?? 'Retailer',
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        fulfilmentMethod: order.fulfilmentMethod,
        subtotal: order.subtotal,
        subOrders: (order.subOrders ?? []).map((subOrder) => ({
          id: subOrder.id,
          wholesalerName: subOrder.wholesalerName,
          status: subOrder.status,
          amount: subOrder.amount,
        })),
      });
    }
  }
  return orders.sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(offset, offset + 200);
}

export async function listAdminOrders(offset = 0): Promise<AdminOrder[]> {
  if (!supabase) return listDemoOrders(offset);
  const { data: orders, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).range(offset, offset + 199);
  if (error) throw error;
  if (!orders.length) return [];
  const orderIds = orders.map((order) => order.id);
  const retailerIds = [...new Set(orders.map((order) => order.retailer_id))];
  const [{ data: subOrders, error: subOrdersError }, { data: businesses, error: businessesError }] = await Promise.all([
    supabase.from('sub_orders').select('*').in('order_id', orderIds),
    supabase.from('business_profiles').select('user_id, business_name').in('user_id', retailerIds),
  ]);
  if (subOrdersError) throw subOrdersError;
  if (businessesError) throw businessesError;
  const wholesalerIds = [...new Set(subOrders.map((subOrder) => subOrder.wholesaler_id))];
  const { data: wholesalerBusinesses, error: wholesalerError } = wholesalerIds.length
    ? await supabase.from('business_profiles').select('user_id, business_name').in('user_id', wholesalerIds)
    : { data: [], error: null };
  if (wholesalerError) throw wholesalerError;
  const businessNameById = new Map([...businesses, ...wholesalerBusinesses].map((business) => [business.user_id, business.business_name]));
  const subOrdersByOrder = new Map<string, AdminOrder['subOrders']>();
  for (const subOrder of subOrders) {
    const related = subOrdersByOrder.get(subOrder.order_id) ?? [];
    related.push({
      id: subOrder.id,
      wholesalerName: businessNameById.get(subOrder.wholesaler_id) ?? 'Wholesaler',
      status: subOrder.status,
      amount: Number(subOrder.amount),
    });
    subOrdersByOrder.set(subOrder.order_id, related);
  }
  return orders.map((order) => ({
    id: order.id,
    createdAt: order.created_at,
    retailerId: order.retailer_id,
    retailerName: businessNameById.get(order.retailer_id) ?? 'Retailer',
    status: order.status,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    fulfilmentMethod: order.fulfilment_method,
    subtotal: Number(order.subtotal),
    subOrders: subOrdersByOrder.get(order.id) ?? [],
  }));
}

export async function countAdminOrdersToday(): Promise<number> {
  if (!supabase) {
    const orders = listDemoOrders(0);
    for (let offset = 200; ; offset += 200) {
      const next = listDemoOrders(offset);
      orders.push(...next);
      if (next.length < 200) break;
    }
    const today = new Date();
    return orders.filter((order) => {
      const created = new Date(order.createdAt);
      return created.getFullYear() === today.getFullYear()
        && created.getMonth() === today.getMonth()
        && created.getDate() === today.getDate();
    }).length;
  }
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count, error } = await supabase.from('orders')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startOfDay.toISOString());
  if (error) throw error;
  return count ?? 0;
}

export async function listAdminAccounts(): Promise<AdminAccount[]> {
  if (!supabase) {
    return demoSession.listAccounts().map((account) => ({
      id: account.id,
      email: account.email,
      role: account.role,
      status: account.status,
      businessName: account.businessName,
      shopNumber: account.shopNumber,
      gstNumber: account.gstNumber,
      fssaiNumber: account.fssaiNumber,
      contactName: account.contactName,
      contactPhone: account.contactPhone,
      createdAt: '',
    }));
  }
  const { data: profiles, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  if (!profiles.length) return [];
  const { data: businesses, error: businessError } = await supabase
    .from('business_profiles')
    .select('user_id, business_name, shop_number, gst_number, fssai_number, contact_name, contact_phone')
    .in('user_id', profiles.map((profile) => profile.id));
  if (businessError) throw businessError;
  const businessById = new Map(businesses.map((business) => [business.user_id, business]));
  return profiles.flatMap((profile) => {
    const business = businessById.get(profile.id);
    if (!business) return [];
    return [{
      id: profile.id,
      email: profile.email,
      role: profile.role,
      status: profile.status,
      businessName: business.business_name,
      shopNumber: business.shop_number,
      gstNumber: business.gst_number,
      fssaiNumber: business.fssai_number,
      contactName: business.contact_name,
      contactPhone: business.contact_phone,
      createdAt: profile.created_at,
    }];
  });
}

export async function setAdminAccountStatus(
  account: AdminAccount,
  status: Extract<AccountStatus, 'approved' | 'suspended'>,
  reason: string,
) {
  if (supabase) {
    const { error } = await supabase.rpc('admin_set_account_status', {
      target_user_id: account.id,
      status_input: status,
      reason_input: reason.trim() || null,
    });
    if (error) throw error;
    return;
  }
  demoSession.setAccountStatus(account.id, status, reason);
}

export async function deleteAdminAccount(account: AdminAccount) {
  if (supabase) {
    const { error } = await supabase.from('profiles').delete().eq('id', account.id);
    if (error) throw error;
    return;
  }
  demoSession.deleteAccount(account.id);
}

export async function listAdminSettings(): Promise<AdminSetting[]> {
  if (!supabase) {
    const saved = localStorage.getItem(demoSettingsKey);
    if (!saved) return defaultSettings;
    const parsed = JSON.parse(saved) as Partial<Record<AdminSettingKey, number | string>>;
    return defaultSettings.map((setting) => {
      const value = parsed[setting.key] ?? setting.value;
      if (setting.key === 'market_open_time' || setting.key === 'market_close_time') {
        if (typeof value !== 'string') throw new Error(`Setting ${setting.key} must be a time string.`);
        return { key: setting.key, value };
      }
      const numberValue = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(numberValue)) throw new Error(`Setting ${setting.key} must be numeric.`);
      return { key: setting.key, value: numberValue };
    });
  }
  const { data, error } = await supabase.from('app_settings').select('key, value').in('key', adminSettingKeys);
  if (error) throw error;
  const saved = new Map(data.map(({ key, value }) => [key, value]));
  return defaultSettings.map((setting) => {
    const value = saved.get(setting.key);
    if (value === undefined) return setting;
    if (setting.key === 'market_open_time' || setting.key === 'market_close_time') {
      if (typeof value !== 'string') throw new Error(`Setting ${setting.key} must be a time string.`);
      return { key: setting.key, value };
    }
    const numberValue = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numberValue)) throw new Error(`Setting ${setting.key} must be numeric.`);
    return { key: setting.key, value: numberValue };
  });
}

export async function updateAdminSetting(setting: AdminSetting) {
  const assertValidSetting = async () => {
    if (setting.key === 'cod_order_cap' || setting.key === 'slot_default_capacity'
      || setting.key === 'slot_publish_days_ahead' || setting.key === 'slot_length_minutes') {
      const ranges: Record<AdminNumericSettingKey, [number, number]> = {
        cod_order_cap: [1, 1000000],
        slot_default_capacity: [1, 100],
        slot_publish_days_ahead: [0, 30],
        slot_length_minutes: [15, 720],
      };
      if (!Number.isInteger(setting.value) || setting.value < ranges[setting.key][0]
        || setting.value > ranges[setting.key][1]) {
        throw new Error('Enter a whole number within the allowed range.');
      }
    } else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(setting.value)) {
      throw new Error('Enter a valid time in HH:MM format.');
    }
    if (setting.key === 'market_open_time' || setting.key === 'market_close_time') {
      const settings = await listAdminSettings();
      const values = new Map(settings.map(({ key, value }) => [key, value]));
      values.set(setting.key, setting.value);
      if (String(values.get('market_open_time')) >= String(values.get('market_close_time'))) {
        throw new Error('Market closing time must be after opening time.');
      }
    }
  };
  await assertValidSetting();
  if (supabase) {
    const { error } = await supabase.rpc('admin_update_app_setting', {
      setting_key_input: setting.key,
      setting_value_input: setting.value,
    });
    if (error) throw error;
    return;
  }
  const settings = await listAdminSettings();
  const next = Object.fromEntries(settings.map(({ key, value }) => [key, value]));
  next[setting.key] = setting.value;
  localStorage.setItem(demoSettingsKey, JSON.stringify(next));
  demoSession.recordAdminAudit('app_setting_updated', { key: setting.key, after: setting.value });
}

export async function listAdminMasterData(): Promise<AdminMasterData> {
  if (!supabase) {
    const saved = localStorage.getItem(demoCategoryRatesKey);
    const rates = saved ? JSON.parse(saved) as Record<string, number> : {};
    return {
      categories: categories.map((name) => ({ name, active: true, gstRate: Number(rates[name] ?? 0) })),
      grades: grades.map((name) => ({ name, active: true })),
      units: units.map((name) => ({ name, active: true })),
    };
  }
  const [categoryResult, gradeResult, unitResult] = await Promise.all([
    supabase.from('product_categories').select('name, active, gst_rate').order('name'),
    supabase.from('product_grades').select('name, active').order('name'),
    supabase.from('product_units').select('name, active').order('name'),
  ]);
  if (categoryResult.error) throw categoryResult.error;
  if (gradeResult.error) throw gradeResult.error;
  if (unitResult.error) throw unitResult.error;
  return {
    categories: categoryResult.data.map((item) => ({ name: item.name, active: item.active, gstRate: Number(item.gst_rate) })),
    grades: gradeResult.data.map((item) => ({ name: item.name, active: item.active })),
    units: unitResult.data.map((item) => ({ name: item.name, active: item.active })),
  };
}

export async function updateCategoryGstRate(name: string, rate: number) {
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error('GST reference rate must be between 0 and 100 percent.');
  if (supabase) {
    const { error } = await supabase.rpc('admin_update_category_gst_rate', {
      category_name_input: name,
      gst_rate_input: rate,
    });
    if (error) throw error;
    return;
  }
  const saved = localStorage.getItem(demoCategoryRatesKey);
  const rates = saved ? JSON.parse(saved) as Record<string, number> : {};
  rates[name] = rate;
  localStorage.setItem(demoCategoryRatesKey, JSON.stringify(rates));
  demoSession.recordAdminAudit('category_gst_rate_updated', { category: name, after: rate });
}

export async function listAdminAudit(): Promise<AdminAuditEntry[]> {
  if (!supabase) {
    const transportAudit: { actorId: string; action: string; details: Record<string, unknown>; createdAt: string }[] = JSON.parse(
      localStorage.getItem('kirana-demo-transport-audit') ?? '[]',
    );
    if (!Array.isArray(transportAudit)) throw new Error('Saved demo transport audit log is invalid.');
    const entries = [
      ...demoSession.auditEntries().map((entry) => ({ actorId: 'demo-admin', ...entry })),
      ...transportAudit,
    ].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 100);
    const accounts = demoSession.listAccounts();
    const emailById = new Map(accounts.map((account) => [account.id, account.email]));
    return entries.map((entry, index) => ({
      id: `demo-${index}`,
      actor: emailById.get(entry.actorId) ?? 'Admin demo',
      subject: typeof entry.details.userId === 'string' ? emailById.get(entry.details.userId) ?? entry.details.userId : '—',
      action: entry.action,
      details: entry.details,
      createdAt: entry.createdAt,
    }));
  }
  const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  const profileIds = [...new Set(data.flatMap((entry) => [entry.actor_id, entry.subject_id].filter((id): id is string => id !== null)))];
  const { data: profiles, error: profileError } = profileIds.length
    ? await supabase.from('profiles').select('id, email').in('id', profileIds)
    : { data: [], error: null };
  if (profileError) throw profileError;
  const emailById = new Map(profiles.map((profile) => [profile.id, profile.email]));
  return data.map((entry) => ({
    id: String(entry.id),
    actor: entry.actor_id ? emailById.get(entry.actor_id) ?? entry.actor_id : 'System',
    subject: entry.subject_id ? emailById.get(entry.subject_id) ?? entry.subject_id : '—',
    action: entry.action,
    details: entry.details,
    createdAt: entry.created_at,
  }));
}
