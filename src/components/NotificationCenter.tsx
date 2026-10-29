import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { supabase } from '../lib/env';
import { listDemoNotifications, markDemoNotificationsRead, onDemoNotification, type DemoNotification } from '../services/demoNotifications';
import { Button } from './Button';
import { Toast } from './Toast';

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export function NotificationCenter() {
  const { account } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveNotification, setLiveNotification] = useState<NotificationRow | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsidePanel = panelRef.current?.contains(target);
      const clickedToggle = buttonRef.current?.contains(target);

      if (!clickedInsidePanel && !clickedToggle) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!account) {
      setNotifications([]);
      return undefined;
    }
    if (!supabase) {
      const mapDemo = (notification: DemoNotification): NotificationRow => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        payload: notification.payload,
        read_at: notification.readAt,
        created_at: notification.createdAt,
      });
      setNotifications(listDemoNotifications(account.id).map(mapDemo));
      const unsubscribe = onDemoNotification((notification) => {
        if (notification.recipientId !== account.id) return;
        const mapped = mapDemo(notification);
        setNotifications((current) => [mapped, ...current.filter((item) => item.id !== mapped.id)].slice(0, 50));
        setLiveNotification(mapped);
        window.setTimeout(() => setLiveNotification((current) => current?.id === mapped.id ? null : current), 6000);
      });
      return unsubscribe;
    }
    const client = supabase;
    if (!client) return undefined;
    let active = true;
    const loadNotifications = async () => {
      const { data, error: loadError } = await client
        .from('notifications')
        .select('id, type, title, message, payload, read_at, created_at')
        .eq('recipient_id', account.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (loadError) throw loadError;
      if (active) {
        setNotifications(data);
        setError(null);
      }
    };
    void loadNotifications().catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load notifications.');
    });
    const channel = client
      .channel(`notifications:${account.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${account.id}`,
      }, (event) => {
        const notification = event.new as NotificationRow;
        setNotifications((current) => [notification, ...current.filter((item) => item.id !== notification.id)].slice(0, 50));
        setLiveNotification(notification);
        window.setTimeout(() => setLiveNotification((current) => current?.id === notification.id ? null : current), 6000);
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' && active) setError('Live notifications are temporarily unavailable.');
      });
    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [account]);

  if (!account) return null;
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  const markRead = async (ids: string[]) => {
    if (!ids.length) return;
    if (!supabase) {
      const readAt = markDemoNotificationsRead(account.id, ids);
      setNotifications((current) => current.map((notification) =>
        ids.includes(notification.id) ? { ...notification, read_at: readAt } : notification,
      ));
      return;
    }
    const readAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .in('id', ids)
      .eq('recipient_id', account.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setNotifications((current) => current.map((notification) =>
      ids.includes(notification.id) ? { ...notification, read_at: readAt } : notification,
    ));
  };

  return (
    <>
    {liveNotification ? (
      <div className="fixed right-4 top-16 z-[60] w-[min(24rem,calc(100vw-2rem))]">
        <Toast title={liveNotification.title} message={liveNotification.message} variant="info" />
      </div>
    ) : null}
    <div className="relative">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="relative"
      >
        <Bell size={18} />
        {unreadCount ? <span className="ml-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
      </Button>
      {open ? (
        <section ref={panelRef} aria-label="Notifications" className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <header className="flex items-center justify-between border-b border-slate-100 p-4">
            <div><h2 className="font-bold">Notifications</h2><p className="text-xs text-slate-500">{unreadCount} unread</p></div>
            <Button size="sm" variant="ghost" disabled={!unreadCount} onClick={() => void markRead(notifications.filter((item) => !item.read_at).map((item) => item.id))}>
              <CheckCheck size={15} className="mr-1" /> Mark all read
            </Button>
          </header>
          {error ? <p role="alert" className="m-3 rounded-lg bg-red-50 p-3 text-xs text-red-800">{error}</p> : null}
          <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {!notifications.length ? <p className="p-6 text-center text-sm text-slate-500">You’re all caught up.</p> : null}
            {notifications.map((notification) => (
              <button
                type="button"
                key={notification.id}
                onClick={() => void markRead([notification.id])}
                className={`block w-full px-4 py-3 text-left hover:bg-slate-50 ${notification.read_at ? '' : 'bg-emerald-50/60'}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">{notification.title}</span>
                  {!notification.read_at ? <span className="h-2 w-2 rounded-full bg-emerald-600" /> : null}
                </span>
                <span className="mt-1 block text-sm text-slate-600">{notification.message}</span>
                <span className="mt-1 block text-[11px] text-slate-400">{new Date(notification.created_at).toLocaleString('en-IN')}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
    </>
  );
}
