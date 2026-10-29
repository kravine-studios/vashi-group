import type { AccountProfile } from '../types';
import { supabase } from '../lib/env';
import { addDemoNotification } from './demoNotifications';
import { demoSession } from './demoAuth';

export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'rejected';
export type DisputeResolution = 'refund' | 'replacement' | 'dismissed';
export type DisputeReason = 'missing_items' | 'damaged_goods' | 'wrong_items' | 'quality_issue' | 'payment_issue' | 'other';

export type DisputeMessage = {
  id: string;
  senderId: string;
  message: string;
  createdAt: string;
};

export type DisputeRecord = {
  id: string;
  orderId: string;
  subOrderId: string | null;
  raisedBy: string;
  reason: DisputeReason;
  description: string;
  photoPaths: string[];
  status: DisputeStatus;
  resolution: DisputeResolution | null;
  resolutionNotes: string | null;
  createdAt: string;
  messages: DisputeMessage[];
};

const demoDisputesKey = 'kirana-demo-disputes';

function readDemoDisputes(): DisputeRecord[] {
  const saved = localStorage.getItem(demoDisputesKey);
  if (!saved) return [];
  const parsed: unknown = JSON.parse(saved);
  if (!Array.isArray(parsed)) throw new Error('Saved demo disputes are invalid.');
  return parsed as DisputeRecord[];
}

function findDemoOrder(orderId: string) {
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith('kirana-demo-orders:')) continue;
    const saved = localStorage.getItem(key);
    if (!saved) continue;
    const orders = JSON.parse(saved) as {
      id: string;
      status?: string;
      subOrders?: { id: string; wholesalerId: string }[];
    }[];
    const order = orders.find((candidate) => candidate.id === orderId);
    if (order) return { order, retailerId: key.slice('kirana-demo-orders:'.length) };
  }
  return null;
}

function demoDisputeParticipants(dispute: DisputeRecord) {
  const found = findDemoOrder(dispute.orderId);
  if (!found) return [] as string[];
  return [...new Set([
    found.retailerId,
    ...(found.order.subOrders ?? [])
      .filter((subOrder) => !dispute.subOrderId || subOrder.id === dispute.subOrderId)
      .map((subOrder) => subOrder.wholesalerId),
  ])];
}

function mapDispute(row: {
  id: string;
  order_id: string;
  sub_order_id: string | null;
  raised_by: string;
  reason: DisputeReason;
  description: string;
  photo_paths: string[];
  status: DisputeStatus;
  resolution: DisputeResolution | null;
  resolution_notes: string | null;
  created_at: string;
}, messages: DisputeMessage[] = []): DisputeRecord {
  return {
    id: row.id,
    orderId: row.order_id,
    subOrderId: row.sub_order_id,
    raisedBy: row.raised_by,
    reason: row.reason,
    description: row.description,
    photoPaths: row.photo_paths,
    status: row.status,
    resolution: row.resolution,
    resolutionNotes: row.resolution_notes,
    createdAt: row.created_at,
    messages,
  };
}

export async function listDisputes(account: AccountProfile): Promise<DisputeRecord[]> {
  if (!supabase) {
    const disputes = readDemoDisputes();
    return disputes.filter((dispute) => account.role === 'super_admin'
      || demoDisputeParticipants(dispute).includes(account.id));
  }
  let query = supabase.from('disputes').select('*').order('created_at', { ascending: false }).limit(100);
  if (account.role !== 'super_admin') {
    const { data: participantOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('retailer_id', account.id);
    if (ordersError) throw ordersError;
    const { data: participantSubOrders, error: subOrdersError } = await supabase
      .from('sub_orders')
      .select('order_id')
      .eq('wholesaler_id', account.id);
    if (subOrdersError) throw subOrdersError;
    const orderIds = [...new Set([...participantOrders.map((order) => order.id), ...participantSubOrders.map((order) => order.order_id)])];
    if (!orderIds.length) return [];
    query = query.in('order_id', orderIds);
  }
  const { data, error } = await query;
  if (error) throw error;
  const { data: messageRows, error: messagesError } = data.length
    ? await supabase.from('dispute_messages').select('id, dispute_id, sender_id, message, created_at').in('dispute_id', data.map((row) => row.id)).order('created_at')
    : { data: [], error: null };
  if (messagesError) throw messagesError;
  const byDispute = new Map<string, DisputeMessage[]>();
  for (const row of messageRows) {
    const messages = byDispute.get(row.dispute_id) ?? [];
    messages.push({ id: row.id, senderId: row.sender_id, message: row.message, createdAt: row.created_at });
    byDispute.set(row.dispute_id, messages);
  }
  return data.map((row) => mapDispute(row, byDispute.get(row.id) ?? []));
}

export async function createDispute(
  account: AccountProfile,
  orderId: string,
  subOrderId: string | null,
  reason: DisputeReason,
  description: string,
  photos: File[] = [],
) {
  if (description.trim().length < 10 || description.trim().length > 4000) {
    throw new Error('Describe the issue in 10 to 4000 characters.');
  }
  if (supabase) {
    if (photos.length > 5 || photos.some((photo) => !['image/jpeg', 'image/png', 'image/webp'].includes(photo.type) || photo.size > 5 * 1024 * 1024)) {
      throw new Error('Attach up to five JPG, PNG, or WebP photos, each no larger than 5 MB.');
    }
    const { data: disputeId, error } = await supabase.rpc('create_dispute', {
      order_id_input: orderId,
      sub_order_id_input: subOrderId,
      reason_input: reason,
      description_input: description.trim(),
    });
    if (error) throw error;
    if (!disputeId) throw new Error('The dispute was created but its ID was not returned.');
    const photoPaths: string[] = [];
    try {
      for (const [index, photo] of photos.entries()) {
        const extension = photo.type === 'image/jpeg' ? 'jpg' : photo.type.slice('image/'.length);
        const path = `${account.id}/${disputeId}/${crypto.randomUUID()}-${index}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('dispute-photos').upload(path, photo, {
          contentType: photo.type,
          upsert: false,
        });
        if (uploadError) throw uploadError;
        photoPaths.push(path);
      }
      if (photoPaths.length) {
        const { error: attachError } = await supabase.rpc('attach_dispute_photos', {
          dispute_id_input: disputeId,
          photo_paths_input: photoPaths,
        });
        if (attachError) throw attachError;
      }
    } catch (photoError) {
      const reason = photoError instanceof Error ? photoError.message : 'unknown storage error';
      throw new Error(`The dispute was created, but the evidence photos could not be attached: ${reason}. Refresh your disputes before trying again.`);
    }
    return;
  }
  if (account.role === 'super_admin') throw new Error('Super admins cannot raise a dispute.');
  if (photos.length > 5 || photos.some((photo) => !['image/jpeg', 'image/png', 'image/webp'].includes(photo.type) || photo.size > 5 * 1024 * 1024)) {
    throw new Error('Attach up to five JPG, PNG, or WebP photos, each no larger than 5 MB.');
  }
  const foundOrder = findDemoOrder(orderId);
  if (!foundOrder
    || account.role === 'retailer' && foundOrder.retailerId !== account.id
    || account.role === 'wholesaler' && !foundOrder.order.subOrders?.some((subOrder) =>
      subOrder.wholesalerId === account.id && (!subOrderId || subOrder.id === subOrderId),
    )) {
    throw new Error('You are not a participant in this order.');
  }
  if (subOrderId && !foundOrder.order.subOrders?.some((subOrder) => subOrder.id === subOrderId)) {
    throw new Error('The selected sub-order does not belong to this order.');
  }
  if (foundOrder.order.status === 'expired' || foundOrder.order.status === 'cancelled') {
    throw new Error('A dispute cannot be raised for an expired or cancelled order.');
  }
  const dispute: DisputeRecord = {
    id: crypto.randomUUID(),
    orderId,
    subOrderId,
    raisedBy: account.id,
    reason,
    description: description.trim(),
    photoPaths: await Promise.all(photos.map(async (photo) => {
      const path = `demo-photo:${crypto.randomUUID()}`;
      await saveDemoPhoto(path, photo);
      return path;
    })),
    status: 'open',
    resolution: null,
    resolutionNotes: null,
    createdAt: new Date().toISOString(),
    messages: [],
  };
  localStorage.setItem(demoDisputesKey, JSON.stringify([dispute, ...readDemoDisputes()]));
  addDemoNotification('demo-admin', 'dispute_raised', 'Dispute raised', `A new dispute needs review: ${reason.replace('_', ' ')}.`, { dispute_id: dispute.id });
  demoDisputeParticipants(dispute).filter((recipient) => recipient !== account.id).forEach((recipient) => {
    addDemoNotification(recipient, 'dispute_raised', 'Dispute raised', 'A dispute was opened for an order involving your shop.', { dispute_id: dispute.id });
  });
}

function openDemoPhotoDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('kirana-demo-disputes', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('photos', { keyPath: 'path' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open local photo storage.'));
  });
}

async function saveDemoPhoto(path: string, file: File) {
  const database = await openDemoPhotoDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('photos', 'readwrite');
    transaction.objectStore('photos').put({ path, blob: file });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save a dispute photo locally.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Local dispute photo storage was aborted.'));
  });
  database.close();
}

const demoPhotoUrls = new Map<string, string>();

export async function getDisputePhotoUrl(path: string): Promise<string> {
  if (!supabase) {
    if (!path.startsWith('demo-photo:')) return path;
    const cachedUrl = demoPhotoUrls.get(path);
    if (cachedUrl) return cachedUrl;
    const database = await openDemoPhotoDatabase();
    const blob = await new Promise<Blob>((resolve, reject) => {
      const request = database.transaction('photos', 'readonly').objectStore('photos').get(path);
      request.onsuccess = () => {
        const stored = request.result as { blob?: Blob } | undefined;
        if (stored?.blob) resolve(stored.blob);
        else reject(new Error('A locally saved dispute photo could not be found.'));
      };
      request.onerror = () => reject(request.error ?? new Error('Unable to load a dispute photo.'));
    });
    database.close();
    const url = URL.createObjectURL(blob);
    demoPhotoUrls.set(path, url);
    return url;
  }
  const { data, error } = await supabase.storage.from('dispute-photos').createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function addDisputeMessage(accountId: string, disputeId: string, message: string) {
  if (!message.trim() || message.trim().length > 4000) throw new Error('Message must be between 1 and 4000 characters.');
  if (supabase) {
    const { error } = await supabase.rpc('add_dispute_message', { dispute_id_input: disputeId, message_input: message.trim() });
    if (error) throw error;
    return;
  }
  const disputes = readDemoDisputes();
  const dispute = disputes.find((candidate) => candidate.id === disputeId);
  if (!dispute) throw new Error('Dispute not found.');
  if (!demoDisputeParticipants(dispute).includes(accountId)) throw new Error('You cannot access this dispute.');
  dispute.messages.push({ id: crypto.randomUUID(), senderId: accountId, message: message.trim(), createdAt: new Date().toISOString() });
  localStorage.setItem(demoDisputesKey, JSON.stringify(disputes));
  addDemoNotification('demo-admin', 'dispute_updated', 'Dispute updated', 'A participant added a message to a dispute.', { dispute_id: disputeId });
  demoDisputeParticipants(dispute).filter((recipient) => recipient !== accountId).forEach((recipient) => {
    addDemoNotification(recipient, 'dispute_updated', 'Dispute updated', 'A participant added a message to a dispute.', { dispute_id: disputeId });
  });
}

export async function updateDispute(
  account: AccountProfile,
  disputeId: string,
  status: DisputeStatus,
  resolution: DisputeResolution | null,
  resolutionNotes: string | null,
  message: string,
) {
  if (supabase) {
    const { error } = await supabase.rpc('admin_update_dispute', {
      dispute_id_input: disputeId,
      status_input: status,
      resolution_input: resolution,
      resolution_notes_input: resolutionNotes,
      message_input: message || null,
    });
    if (error) throw error;
    return;
  }
  const disputes = readDemoDisputes();
  const dispute = disputes.find((candidate) => candidate.id === disputeId);
  if (account.role !== 'super_admin') throw new Error('Only a super admin can manage disputes.');
  if (!dispute) throw new Error('Dispute not found.');
  const beforeStatus = dispute.status;
  if ((status === 'resolved' || status === 'rejected') && (!resolution || !resolutionNotes?.trim())) {
    throw new Error('Choose a resolution and enter resolution notes.');
  }
  dispute.status = status;
  dispute.resolution = status === 'resolved' || status === 'rejected' ? resolution : null;
  dispute.resolutionNotes = status === 'resolved' || status === 'rejected' ? resolutionNotes?.trim() ?? null : null;
  if (message.trim()) dispute.messages.push({ id: crypto.randomUUID(), senderId: 'demo-admin', message: message.trim(), createdAt: new Date().toISOString() });
  localStorage.setItem(demoDisputesKey, JSON.stringify(disputes));
  demoSession.recordAdminAudit('dispute_updated', {
    disputeId,
    beforeStatus,
    afterStatus: status,
    resolution,
  });
  demoDisputeParticipants(dispute).forEach((recipient) => addDemoNotification(
    recipient,
    'dispute_updated',
    'Dispute updated',
    `Dispute status: ${status.replace('_', ' ')}.`,
    { dispute_id: disputeId, status },
  ));
}
