export type DemoNotification = {
  id: string;
  recipientId: string;
  type: string;
  title: string;
  message: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

const demoNotificationsKey = 'kirana-demo-notifications';
const demoNotificationEvent = 'kirana-demo-notification';

function readNotifications(): DemoNotification[] {
  const saved = localStorage.getItem(demoNotificationsKey);
  if (!saved) return [];
  const parsed: unknown = JSON.parse(saved);
  if (!Array.isArray(parsed)) throw new Error('Saved demo notifications are invalid.');
  return parsed as DemoNotification[];
}

export function addDemoNotification(
  recipientId: string,
  type: string,
  title: string,
  message: string,
  payload: Record<string, unknown> = {},
) {
  const notification: DemoNotification = {
    id: crypto.randomUUID(),
    recipientId,
    type,
    title,
    message,
    payload,
    readAt: null,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(demoNotificationsKey, JSON.stringify([notification, ...readNotifications()]));
  window.dispatchEvent(new CustomEvent(demoNotificationEvent, { detail: notification }));
}

export function listDemoNotifications(recipientId: string) {
  return readNotifications().filter((notification) => notification.recipientId === recipientId);
}

export function markDemoNotificationsRead(recipientId: string, ids: string[]) {
  const readAt = new Date().toISOString();
  const updated = readNotifications().map((notification) =>
    notification.recipientId === recipientId && ids.includes(notification.id)
      ? { ...notification, readAt }
      : notification,
  );
  localStorage.setItem(demoNotificationsKey, JSON.stringify(updated));
  return readAt;
}

export function onDemoNotification(listener: (notification: DemoNotification) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<DemoNotification>).detail);
  window.addEventListener(demoNotificationEvent, handler);
  return () => window.removeEventListener(demoNotificationEvent, handler);
}
