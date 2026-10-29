import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '../lib/formatters';
import {
  listAdminAccounts,
  listAdminAudit,
  listAdminOrders,
  listAdminSettings,
  listAdminMasterData,
  countAdminOrdersToday,
  setAdminAccountStatus,
  updateCategoryGstRate,
  updateAdminSetting,
  type AdminAccount,
  type AdminAuditEntry,
  type AdminMasterData,
  type AdminOrder,
  type AdminSetting,
  type AdminSettingKey,
} from '../services/adminOperations';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Badge } from './Badge';

type AdminTab = 'orders' | 'accounts' | 'masters' | 'settings' | 'audit';
const tabs: { value: AdminTab; label: string }[] = [
  { value: 'orders', label: 'All orders' },
  { value: 'accounts', label: 'User management' },
  { value: 'masters', label: 'Master data' },
  { value: 'settings', label: 'Settings' },
  { value: 'audit', label: 'Audit log' },
];

function saveSettingValue(setting: AdminSetting, value: string | number) {
  if (setting.key === 'market_open_time' || setting.key === 'market_close_time') {
    return updateAdminSetting({ key: setting.key, value: String(value) });
  }
  return updateAdminSetting({ key: setting.key, value: Number(value) });
}

export function AdminOperationsPanel({ onOrdersToday }: { onOrdersToday: (count: number) => void }) {
  const [tab, setTab] = useState<AdminTab>('orders');
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [masterData, setMasterData] = useState<AdminMasterData>({ categories: [], grades: [], units: [] });
  const [audit, setAudit] = useState<AdminAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [ordersOffset, setOrdersOffset] = useState(0);
  const [hasMoreOrders, setHasMoreOrders] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loadedOrders, loadedAccounts, loadedSettings, loadedMasterData, loadedAudit, todayCount] = await Promise.all([
        listAdminOrders(0),
        listAdminAccounts(),
        listAdminSettings(),
        listAdminMasterData(),
        listAdminAudit(),
        countAdminOrdersToday(),
      ]);
      setOrders(loadedOrders);
      setOrdersOffset(loadedOrders.length);
      setHasMoreOrders(loadedOrders.length === 200);
      setAccounts(loadedAccounts);
      setSettings(loadedSettings);
      setMasterData(loadedMasterData);
      setAudit(loadedAudit);
      onOrdersToday(todayCount);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load admin operations.');
    } finally {
      setLoading(false);
    }
  }, [onOrdersToday]);

  const loadMoreOrders = async () => {
    setLoadingMore(true);
    setError(null);
    try {
      const nextPage = await listAdminOrders(ordersOffset);
      setOrders((current) => [...current, ...nextPage]);
      setOrdersOffset((current) => current + nextPage.length);
      setHasMoreOrders(nextPage.length === 200);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load more orders.');
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runAction = async (id: string, action: () => Promise<void>, successMessage: string) => {
    setSavingId(id);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(successMessage);
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to complete this action.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-card md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Platform controls</p>
          <h2 className="mt-1 text-xl font-bold">Administration</h2>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void refresh()} disabled={loading}>Refresh data</Button>
      </header>
      <nav aria-label="Admin operations" className="mt-5 flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
        {tabs.map((item) => (
          <button
            type="button"
            key={item.value}
            aria-current={tab === item.value ? 'page' : undefined}
            onClick={() => setTab(item.value)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 ${tab === item.value ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {notice ? <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}
      {loading ? <p className="py-10 text-center text-sm text-slate-500">Loading administration data…</p> : (
        <div className="pt-5">
          {tab === 'orders' ? <OrdersPanel orders={orders} hasMore={hasMoreOrders} loadingMore={loadingMore} onLoadMore={() => void loadMoreOrders()} /> : null}
          {tab === 'accounts' ? <AccountsPanel accounts={accounts} savingId={savingId} runAction={runAction} /> : null}
          {tab === 'masters' ? <MasterDataPanel data={masterData} savingId={savingId} runAction={runAction} /> : null}
          {tab === 'settings' ? <SettingsPanel settings={settings} savingId={savingId} runAction={runAction} /> : null}
          {tab === 'audit' ? <AuditPanel entries={audit} /> : null}
        </div>
      )}
    </section>
  );
}

function OrdersPanel({ orders, hasMore, loadingMore, onLoadMore }: { orders: AdminOrder[]; hasMore: boolean; loadingMore: boolean; onLoadMore: () => void }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const filtered = useMemo(() => orders.filter((order) =>
    (!status || order.status === status)
    && (!search.trim() || `${order.id} ${order.retailerName}`.toLowerCase().includes(search.trim().toLowerCase())),
  ), [orders, search, status]);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="min-w-[220px] flex-1 text-sm font-medium">Search order or retailer
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Order ID or business name" />
        </label>
        <label className="text-sm font-medium">Order status
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 block rounded-xl border border-slate-300 bg-white px-3 py-2">
            <option value="">All statuses</option>
            <option value="pending_payment">Pending payment</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="expired">Expired</option><option value="cancelled">Cancelled</option>
          </select>
        </label>
        <span className="pb-2 text-xs text-slate-500">Showing {orders.length} recent orders</span>
      </div>
      {!filtered.length ? <EmptyState title="No orders found" description="Try a different search or status filter." /> : (
        <div className="space-y-3">
          {filtered.map((order) => <OrderCard key={order.id} order={order} />)}
        </div>
      )}
      {hasMore ? <div className="mt-4 text-center"><Button variant="secondary" onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load older orders'}</Button></div> : null}
    </>
  );
}

function OrderCard({ order }: { order: AdminOrder }) {
  return (
    <details className="rounded-2xl border border-slate-200 p-4 open:bg-slate-50">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{order.retailerName} <span className="text-xs font-normal text-slate-500">· #{order.id.slice(0, 8).toUpperCase()}</span></p>
          <p className="mt-1 text-xs text-slate-500">{new Date(order.createdAt).toLocaleString('en-IN')} · {order.paymentMethod.toUpperCase()} · {order.paymentStatus.replace('_', ' ')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={order.status === 'completed' ? 'success' : order.status === 'cancelled' || order.status === 'expired' ? 'danger' : 'warning'}>{order.status.replace('_', ' ')}</Badge>
          <span className="font-bold">{formatCurrency(order.subtotal)}</span>
        </div>
      </summary>
      <div className="mt-3 border-t border-slate-200 pt-3">
        <p className="text-xs text-slate-500">Fulfilment: {order.fulfilmentMethod.replace('_', ' ')} · Retailer ID: {order.retailerId}</p>
        <ul className="mt-2 space-y-1">
          {order.subOrders.map((subOrder) => (
            <li key={subOrder.id} className="flex flex-wrap justify-between gap-2 text-sm">
              <span>{subOrder.wholesalerName} · {subOrder.status.replace('_', ' ')}</span><span>{formatCurrency(subOrder.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function AccountsPanel({
  accounts,
  savingId,
  runAction,
}: {
  accounts: AdminAccount[];
  savingId: string | null;
  runAction: (id: string, action: () => Promise<void>, success: string) => Promise<void>;
}) {
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState<Record<string, string>>({});
  const filtered = accounts.filter((account) => (!role || account.role === role) && (!status || account.status === status));
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="text-sm font-medium">Role
          <select value={role} onChange={(event) => setRole(event.target.value)} className="mt-1 block rounded-xl border border-slate-300 bg-white px-3 py-2">
            <option value="">All roles</option><option value="retailer">Retailer</option><option value="wholesaler">Wholesaler</option><option value="super_admin">Super admin</option>
          </select>
        </label>
        <label className="text-sm font-medium">Account status
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 block rounded-xl border border-slate-300 bg-white px-3 py-2">
            <option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="suspended">Suspended</option>
          </select>
        </label>
      </div>
      {!filtered.length ? <EmptyState title="No accounts match" description="Change the role or status filters." /> : (
        <div className="space-y-3">
          {filtered.map((account) => (
            <article key={account.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{account.businessName} <span className="ml-1 text-xs font-normal text-slate-500">· {account.role.replace('_', ' ')}</span></p>
                  <p className="text-sm text-slate-600">{account.email} · {account.contactName} · {account.contactPhone}</p>
                  <p className="mt-1 text-xs text-slate-500">Shop {account.shopNumber} · GST {account.gstNumber} · FSSAI {account.fssaiNumber}</p>
                </div>
                <Badge tone={account.status === 'approved' ? 'success' : account.status === 'suspended' || account.status === 'rejected' ? 'danger' : 'warning'}>{account.status}</Badge>
              </div>
              {account.role !== 'super_admin' && (account.status === 'approved' || account.status === 'suspended') ? (
                <div className="mt-3 flex flex-wrap items-end justify-end gap-2">
                  {account.status === 'approved' ? (
                    <>
                      <label className="min-w-[200px] flex-1 text-xs font-medium">Reason for suspension
                        <input value={reason[account.id] ?? ''} onChange={(event) => setReason((current) => ({ ...current, [account.id]: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" minLength={5} />
                      </label>
                      <Button size="sm" variant="danger" disabled={savingId === account.id || (reason[account.id] ?? '').trim().length < 5} onClick={() => void runAction(account.id, () => setAdminAccountStatus(account, 'suspended', reason[account.id] ?? ''), 'Account suspended.')}>Suspend</Button>
                    </>
                  ) : <Button size="sm" disabled={savingId === account.id} onClick={() => void runAction(account.id, () => setAdminAccountStatus(account, 'approved', ''), 'Account reinstated.')}>Reinstate</Button>}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function MasterDataPanel({
  data,
  savingId,
  runAction,
}: {
  data: AdminMasterData;
  savingId: string | null;
  runAction: (id: string, action: () => Promise<void>, success: string) => Promise<void>;
}) {
  const [rates, setRates] = useState<Record<string, string>>({});
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold">Product categories and GST reference</h3>
        <p className="mt-1 text-sm text-slate-500">Reference rates are stored for administration only; this mock checkout does not calculate tax or generate invoices.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {data.categories.map((category) => (
            <form key={category.name} className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 p-4" onSubmit={(event) => {
              event.preventDefault();
              const nextRate = Number(rates[category.name] ?? category.gstRate);
              void runAction(`gst-${category.name}`, () => updateCategoryGstRate(category.name, nextRate), `${category.name} GST reference rate updated.`);
            }}>
              <div className="min-w-[140px] flex-1">
                <p className="font-semibold">{category.name}</p>
                <p className="text-xs text-slate-500">{category.active ? 'Active catalogue category' : 'Inactive category'}</p>
              </div>
              <label className="text-sm font-medium">GST %
                <input type="number" min="0" max="100" step="0.01" value={rates[category.name] ?? category.gstRate} onChange={(event) => setRates((current) => ({ ...current, [category.name]: event.target.value }))} className="mt-1 block w-28 rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <Button type="submit" size="sm" variant="secondary" disabled={savingId === `gst-${category.name}`}>Save</Button>
            </form>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <MasterValueList title="Product grades" items={data.grades} />
        <MasterValueList title="Product units" items={data.units} />
      </div>
    </div>
  );
}

function MasterValueList({ title, items }: { title: string; items: { name: string; active: boolean }[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 p-4">
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => <li key={item.name}><Badge tone={item.active ? 'success' : 'danger'}>{item.name}{item.active ? '' : ' · inactive'}</Badge></li>)}
      </ul>
      <p className="mt-2 text-xs text-slate-500">These v1 options are managed through the versioned database seed data.</p>
    </section>
  );
}

function SettingsPanel({
  settings,
  savingId,
  runAction,
}: {
  settings: AdminSetting[];
  savingId: string | null;
  runAction: (id: string, action: () => Promise<void>, success: string) => Promise<void>;
}) {
  const titles: Record<AdminSettingKey, string> = {
    cod_order_cap: 'Maximum COD order value (₹)',
    slot_default_capacity: 'Default orders per transport slot',
    slot_publish_days_ahead: 'Transport publishing window (days)',
    slot_length_minutes: 'Default slot length (minutes)',
    market_open_time: 'Market opening time',
    market_close_time: 'Market closing time',
  };
  const [values, setValues] = useState<Record<string, number | string>>({});
  return (
    <div>
      <p className="mb-4 text-sm text-slate-600">Changes are saved to platform settings and recorded in the audit log.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {settings.map((setting) => {
          const value = values[setting.key] ?? setting.value;
          return (
            <form key={setting.key} className="rounded-2xl border border-slate-200 p-4" onSubmit={(event) => {
              event.preventDefault();
              void runAction(setting.key, () => saveSettingValue(setting, value), `${titles[setting.key]} updated.`);
            }}>
              <label className="block text-sm font-semibold">{titles[setting.key]}
                <input
                  type={setting.key === 'market_open_time' || setting.key === 'market_close_time' ? 'time' : 'number'}
                  min={setting.key === 'cod_order_cap' ? 1 : setting.key === 'slot_default_capacity' ? 1 : setting.key === 'slot_publish_days_ahead' ? 0 : setting.key === 'slot_length_minutes' ? 15 : undefined}
                  max={setting.key === 'cod_order_cap' ? 1000000 : setting.key === 'slot_default_capacity' ? 100 : setting.key === 'slot_publish_days_ahead' ? 30 : setting.key === 'slot_length_minutes' ? 720 : undefined}
                  value={value}
                  onChange={(event) => setValues((current) => ({ ...current, [setting.key]: typeof setting.value === 'number' ? Number(event.target.value) : event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </label>
              <Button type="submit" size="sm" variant="secondary" disabled={savingId === setting.key} className="mt-3">Save setting</Button>
            </form>
          );
        })}
      </div>
    </div>
  );
}

function AuditPanel({ entries }: { entries: AdminAuditEntry[] }) {
  if (!entries.length) return <EmptyState title="No admin activity yet" description="Approvals, transport changes, disputes, settings, and account actions will be listed here." />;
  return (
    <div className="space-y-2">
      <p className="mb-3 text-sm text-slate-500">Latest {entries.length} recorded admin and system events.</p>
      {entries.map((entry) => (
        <article key={entry.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div className="flex flex-wrap justify-between gap-2">
            <p className="text-sm font-semibold">{entry.action.replace(/_/g, ' ')}</p>
            <time className="text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString('en-IN')}</time>
          </div>
          <p className="mt-1 text-xs text-slate-600">By {entry.actor} · Subject {entry.subject}</p>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[11px] text-slate-500">{JSON.stringify(entry.details, null, 2)}</pre>
        </article>
      ))}
    </div>
  );
}
