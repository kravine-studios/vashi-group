import type { AccountProfile } from '../types';
import { supabase } from '../lib/env';
import { addDemoNotification } from './demoNotifications';
import { demoSession } from './demoAuth';
import type { OrderLine, OrderSummary } from './demoOrders';

export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'rejected';
export type DisputeResolution = 'refund' | 'replacement' | 'dismissed';
export type DisputeReason =
  | 'missing_items'
  | 'damaged_goods'
  | 'wrong_items'
  | 'quality_issue'
  | 'payment_issue'
  | 'other';

export type DisputeParticipant = {
  id: string;
  role: 'retailer' | 'wholesaler' | 'super_admin';
  businessName: string;
  contactName: string;
  contactPhone: string;
  shopNumber?: string;
  email?: string;
};

export type DisputeMessage = {
  id: string;
  senderId: string;
  senderName?: string;
  senderRole?: 'super_admin' | 'retailer' | 'wholesaler';
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
  raisedByParty?: DisputeParticipant;
  againstParty?: DisputeParticipant;
  orderAmount?: number;
  subOrderAmount?: number;
  subOrderItems?: OrderLine[];
};

const demoDisputesKey = 'kirana-demo-disputes';

export const disputeReasonLabels: Record<DisputeReason, string> = {
  missing_items: 'Missing Items',
  damaged_goods: 'Damaged Goods',
  wrong_items: 'Wrong Items',
  quality_issue: 'Product Quality Issue',
  payment_issue: 'Payment Issue',
  other: 'General Issue',
};

function readDemoDisputes(): DisputeRecord[] {
  const saved = localStorage.getItem(demoDisputesKey);
  if (!saved) return [];
  const parsed: unknown = JSON.parse(saved);
  if (!Array.isArray(parsed)) throw new Error('Saved demo disputes are invalid.');
  return parsed as DisputeRecord[];
}

function findDemoOrder(orderId: string): { order: OrderSummary; retailerId: string } | null {
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith('kirana-demo-orders:')) continue;
    const saved = localStorage.getItem(key);
    if (!saved) continue;
    try {
      const orders = JSON.parse(saved) as OrderSummary[];
      const order = orders.find((candidate) => candidate.id === orderId);
      if (order) return { order, retailerId: key.slice('kirana-demo-orders:'.length) };
    } catch {
      // ignore parse errors
    }
  }
  return null;
}

function demoDisputeParticipants(dispute: DisputeRecord): string[] {
  const found = findDemoOrder(dispute.orderId);
  if (!found) return [];
  return [
    ...new Set([
      found.retailerId,
      ...(found.order.subOrders ?? [])
        .filter((subOrder) => !dispute.subOrderId || subOrder.id === dispute.subOrderId)
        .map((subOrder) => subOrder.wholesalerId),
    ]),
  ];
}

function enrichDemoDispute(dispute: DisputeRecord): DisputeRecord {
  const accounts = demoSession.listAccounts();
  const found = findDemoOrder(dispute.orderId);

  let retailerParty: DisputeParticipant | undefined;
  let wholesalerParty: DisputeParticipant | undefined;
  let subOrderAmount: number | undefined;
  let subOrderItems: OrderLine[] | undefined;
  let orderAmount: number | undefined;

  if (found) {
    orderAmount = found.order.subtotal;
    const retAcc = accounts.find((a) => a.id === found.retailerId);
    retailerParty = {
      id: found.retailerId,
      role: 'retailer',
      businessName: found.order.retailer?.businessName || retAcc?.businessName || 'Retailer',
      contactName: found.order.retailer?.contactName || retAcc?.contactName || 'Retailer Contact',
      contactPhone: found.order.retailer?.contactPhone || retAcc?.contactPhone || '',
      shopNumber: found.order.retailer?.shopNumber || retAcc?.shopNumber || '',
      email: retAcc?.email,
    };

    const targetSubOrder = dispute.subOrderId
      ? found.order.subOrders?.find((s) => s.id === dispute.subOrderId)
      : found.order.subOrders?.[0];

    if (targetSubOrder) {
      const whAcc = accounts.find((a) => a.id === targetSubOrder.wholesalerId);
      wholesalerParty = {
        id: targetSubOrder.wholesalerId,
        role: 'wholesaler',
        businessName: targetSubOrder.wholesalerName || whAcc?.businessName || 'Wholesaler',
        contactName: targetSubOrder.wholesalerContactName || whAcc?.contactName || 'Stall Manager',
        contactPhone: targetSubOrder.wholesalerContactPhone || whAcc?.contactPhone || '',
        shopNumber: targetSubOrder.wholesalerShopNumber || whAcc?.shopNumber || '',
        email: whAcc?.email,
      };
      subOrderAmount = targetSubOrder.amount;
      subOrderItems = targetSubOrder.items;
    }
  }

  // Determine who raised vs against whom
  const raisedAccount = accounts.find((a) => a.id === dispute.raisedBy);
  const isWholesaler =
    raisedAccount?.role === 'wholesaler' || (wholesalerParty && dispute.raisedBy === wholesalerParty.id);

  let raisedByParty: DisputeParticipant | undefined;
  let againstParty: DisputeParticipant | undefined;

  if (isWholesaler) {
    raisedByParty =
      wholesalerParty ||
      (raisedAccount
        ? {
            id: raisedAccount.id,
            role: 'wholesaler',
            businessName: raisedAccount.businessName,
            contactName: raisedAccount.contactName,
            contactPhone: raisedAccount.contactPhone,
            shopNumber: raisedAccount.shopNumber || undefined,
            email: raisedAccount.email,
          }
        : undefined);
    againstParty = retailerParty;
  } else {
    raisedByParty =
      retailerParty ||
      (raisedAccount
        ? {
            id: raisedAccount.id,
            role: 'retailer',
            businessName: raisedAccount.businessName,
            contactName: raisedAccount.contactName,
            contactPhone: raisedAccount.contactPhone,
            shopNumber: raisedAccount.shopNumber || undefined,
            email: raisedAccount.email,
          }
        : undefined);
    againstParty = wholesalerParty;
  }

  // Format messages with transparent sender details
  const enrichedMessages: DisputeMessage[] = dispute.messages.map((m) => {
    if (m.senderId === 'demo-admin' || accounts.find((a) => a.id === m.senderId)?.role === 'super_admin') {
      return { ...m, senderName: 'APMC Platform Admin', senderRole: 'super_admin' };
    }
    if (retailerParty && m.senderId === retailerParty.id) {
      return { ...m, senderName: retailerParty.businessName, senderRole: 'retailer' };
    }
    if (wholesalerParty && m.senderId === wholesalerParty.id) {
      return { ...m, senderName: wholesalerParty.businessName, senderRole: 'wholesaler' };
    }
    const acc = accounts.find((a) => a.id === m.senderId);
    return {
      ...m,
      senderName:
        acc?.businessName ||
        (acc?.role === 'retailer' ? 'Retailer' : acc?.role === 'wholesaler' ? 'Wholesaler' : 'Participant'),
      senderRole: acc?.role || 'retailer',
    };
  });

  return {
    ...dispute,
    raisedByParty,
    againstParty,
    orderAmount,
    subOrderAmount,
    subOrderItems,
    messages: enrichedMessages,
  };
}

function mapDispute(
  row: {
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
  },
  messages: DisputeMessage[] = [],
): DisputeRecord {
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
    const filtered = disputes.filter(
      (dispute) => account.role === 'super_admin' || demoDisputeParticipants(dispute).includes(account.id),
    );
    return filtered.map(enrichDemoDispute);
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
    const orderIds = [
      ...new Set([
        ...participantOrders.map((order) => order.id),
        ...participantSubOrders.map((order) => order.order_id),
      ]),
    ];
    if (!orderIds.length) return [];
    query = query.in('order_id', orderIds);
  }
  const { data, error } = await query;
  if (error) throw error;
  const { data: messageRows, error: messagesError } = data.length
    ? await supabase
        .from('dispute_messages')
        .select('id, dispute_id, sender_id, message, created_at')
        .in(
          'dispute_id',
          data.map((row) => row.id),
        )
        .order('created_at')
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
    if (
      photos.length > 5 ||
      photos.some(
        (photo) => !['image/jpeg', 'image/png', 'image/webp'].includes(photo.type) || photo.size > 5 * 1024 * 1024,
      )
    ) {
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
      const reasonMsg = photoError instanceof Error ? photoError.message : 'unknown storage error';
      throw new Error(
        `The dispute was created, but the evidence photos could not be attached: ${reasonMsg}. Refresh your disputes before trying again.`,
      );
    }
    return;
  }

  if (account.role === 'super_admin') throw new Error('Super admins cannot raise a dispute.');
  if (
    photos.length > 5 ||
    photos.some(
      (photo) => !['image/jpeg', 'image/png', 'image/webp'].includes(photo.type) || photo.size > 5 * 1024 * 1024,
    )
  ) {
    throw new Error('Attach up to five JPG, PNG, or WebP photos, each no larger than 5 MB.');
  }
  const foundOrder = findDemoOrder(orderId);
  if (
    !foundOrder ||
    (account.role === 'retailer' && foundOrder.retailerId !== account.id) ||
    (account.role === 'wholesaler' &&
      !foundOrder.order.subOrders?.some(
        (subOrder) => subOrder.wholesalerId === account.id && (!subOrderId || subOrder.id === subOrderId),
      ))
  ) {
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
    photoPaths: await Promise.all(
      photos.map(async (photo) => {
        const path = `demo-photo:${crypto.randomUUID()}`;
        await saveDemoPhoto(path, photo);
        return path;
      }),
    ),
    status: 'open',
    resolution: null,
    resolutionNotes: null,
    createdAt: new Date().toISOString(),
    messages: [],
  };

  localStorage.setItem(demoDisputesKey, JSON.stringify([dispute, ...readDemoDisputes()]));

  // Notification dispatching: notify Admin and all involved parties transparently
  const reasonLabel = disputeReasonLabels[reason] ?? reason.replace('_', ' ');
  const orderRef = `#${orderId.slice(0, 8).toUpperCase()}`;
  const retailerId = foundOrder.retailerId;
  const retailerName = foundOrder.order.retailer?.businessName || 'Retailer';
  const targetSubOrder = subOrderId
    ? foundOrder.order.subOrders?.find((s) => s.id === subOrderId)
    : foundOrder.order.subOrders?.[0];
  const wholesalerId = targetSubOrder?.wholesalerId;
  const wholesalerName = targetSubOrder?.wholesalerName || 'Wholesaler';

  if (account.role === 'wholesaler') {
    // Wholesaler raised dispute against retailer
    // 1. Notify Admin with details of both parties
    addDemoNotification(
      'demo-admin',
      'dispute_raised',
      `Dispute: ${account.businessName} (Wholesaler) vs ${retailerName} (Retailer)`,
      `Wholesaler ${account.businessName} raised a dispute against Retailer ${retailerName} on order ${orderRef} (${reasonLabel}): "${description.trim().slice(0, 120)}..."`,
      { dispute_id: dispute.id, order_id: orderId, sub_order_id: subOrderId, raised_by: account.id, against: retailerId },
    );
    // 2. Notify Retailer so they are aware and can participate in the thread
    addDemoNotification(
      retailerId,
      'dispute_raised',
      `Dispute Opened by Wholesaler ${account.businessName}`,
      `Wholesaler ${account.businessName} raised a dispute on order ${orderRef} regarding ${reasonLabel}. The APMC Admin has been notified for mediation. Check the dispute thread to respond.`,
      { dispute_id: dispute.id, order_id: orderId, sub_order_id: subOrderId, raised_by: account.id },
    );
  } else {
    // Retailer raised dispute against wholesaler
    // 1. Notify Admin with details of both parties
    addDemoNotification(
      'demo-admin',
      'dispute_raised',
      `Dispute: ${account.businessName} (Retailer) vs ${wholesalerName} (Wholesaler)`,
      `Retailer ${account.businessName} raised a dispute against Wholesaler ${wholesalerName} on order ${orderRef} (${reasonLabel}): "${description.trim().slice(0, 120)}..."`,
      { dispute_id: dispute.id, order_id: orderId, sub_order_id: subOrderId, raised_by: account.id, against: wholesalerId },
    );
    // 2. Notify Target Wholesaler(s)
    const targetWholesalers = subOrderId
      ? foundOrder.order.subOrders?.filter((s) => s.id === subOrderId) ?? []
      : foundOrder.order.subOrders ?? [];

    for (const w of targetWholesalers) {
      addDemoNotification(
        w.wholesalerId,
        'dispute_raised',
        `Dispute Opened by Retailer ${account.businessName}`,
        `Retailer ${account.businessName} raised a dispute on order ${orderRef} regarding ${reasonLabel}. The APMC Admin has been notified for mediation. Check the dispute thread to respond.`,
        { dispute_id: dispute.id, order_id: orderId, sub_order_id: subOrderId, raised_by: account.id },
      );
    }
  }
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
  if (accountId !== 'demo-admin' && !demoDisputeParticipants(dispute).includes(accountId)) {
    throw new Error('You cannot access this dispute.');
  }

  const accounts = demoSession.listAccounts();
  const senderAccount = accounts.find((a) => a.id === accountId);
  const senderRole =
    accountId === 'demo-admin' || senderAccount?.role === 'super_admin'
      ? 'super_admin'
      : (senderAccount?.role || 'retailer');
  const senderName =
    senderRole === 'super_admin' ? 'APMC Admin' : (senderAccount?.businessName || 'Participant');

  dispute.messages.push({
    id: crypto.randomUUID(),
    senderId: accountId,
    senderName,
    senderRole,
    message: message.trim(),
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem(demoDisputesKey, JSON.stringify(disputes));

  // Notify all other parties so they can talk through the issue
  const foundOrder = findDemoOrder(dispute.orderId);
  const participantIds = new Set<string>();
  participantIds.add('demo-admin');
  if (foundOrder) {
    participantIds.add(foundOrder.retailerId);
    foundOrder.order.subOrders
      ?.filter((s) => !dispute.subOrderId || s.id === dispute.subOrderId)
      .forEach((s) => participantIds.add(s.wholesalerId));
  }

  for (const recipient of participantIds) {
    if (recipient === accountId) continue;
    addDemoNotification(
      recipient,
      'dispute_updated',
      `Dispute #${disputeId.slice(0, 8).toUpperCase()}: Message from ${senderName}`,
      `${senderName} (${senderRole.replace('_', ' ')}): "${message.trim().slice(0, 120)}${message.trim().length > 120 ? '…' : ''}"`,
      { dispute_id: disputeId, sender_id: accountId },
    );
  }
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
  if (message.trim()) {
    dispute.messages.push({
      id: crypto.randomUUID(),
      senderId: 'demo-admin',
      senderName: 'APMC Platform Admin',
      senderRole: 'super_admin',
      message: message.trim(),
      createdAt: new Date().toISOString(),
    });
  }
  localStorage.setItem(demoDisputesKey, JSON.stringify(disputes));
  demoSession.recordAdminAudit('dispute_updated', {
    disputeId,
    beforeStatus,
    afterStatus: status,
    resolution,
  });

  const foundOrder = findDemoOrder(dispute.orderId);
  const participantIds = new Set<string>();
  if (foundOrder) {
    participantIds.add(foundOrder.retailerId);
    foundOrder.order.subOrders
      ?.filter((s) => !dispute.subOrderId || s.id === dispute.subOrderId)
      .forEach((s) => participantIds.add(s.wholesalerId));
  }

  for (const recipient of participantIds) {
    addDemoNotification(
      recipient,
      'dispute_updated',
      `Dispute #${disputeId.slice(0, 8).toUpperCase()}: Status ${status.replace('_', ' ').toUpperCase()}`,
      `APMC Admin updated dispute status to ${status.replace('_', ' ')}${resolution ? ` (Resolution: ${resolution.toUpperCase()})` : ''}. Notes: ${resolutionNotes?.trim() || 'Check dispute thread for details'}.`,
      { dispute_id: disputeId, status, resolution },
    );
  }
}
