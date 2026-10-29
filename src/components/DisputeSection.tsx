import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { MessageSquareWarning, Send } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { Badge } from './Badge';
import { Button } from './Button';
import {
  addDisputeMessage,
  createDispute,
  listDisputes,
  type DisputeReason,
  type DisputeRecord,
  getDisputePhotoUrl,
} from '../services/disputes';

const reasons: { value: DisputeReason; label: string }[] = [
  { value: 'missing_items', label: 'Missing items' },
  { value: 'damaged_goods', label: 'Damaged goods' },
  { value: 'wrong_items', label: 'Wrong items' },
  { value: 'quality_issue', label: 'Product quality' },
  { value: 'payment_issue', label: 'Payment issue' },
  { value: 'other', label: 'Other' },
];

const statusTone = (status: DisputeRecord['status']) => status === 'resolved'
  ? 'success'
  : status === 'rejected'
    ? 'danger'
    : 'warning';

export function DisputeSection({ orderId, subOrderId }: { orderId: string; subOrderId?: string }) {
  const { account } = useAuth();
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<DisputeReason>('missing_items');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!account) return;
    try {
      const loaded = await listDisputes(account);
      setDisputes(loaded.filter((dispute) => dispute.orderId === orderId
        && (subOrderId ? dispute.subOrderId === subOrderId || dispute.subOrderId === null : true)));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load disputes.');
    }
  }, [account, orderId, subOrderId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submitDispute = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!account) return;
    setSaving(true);
    setError(null);
    try {
      await createDispute(account, orderId, subOrderId ?? null, reason, description, photos);
      setDescription('');
      setPhotos([]);
      setOpen(false);
      await refresh();
    } catch (createError) {
      await refresh();
      setError(createError instanceof Error ? createError.message : 'Unable to raise the dispute.');
    } finally {
      setSaving(false);
    }
  };

  const submitReply = async (event: FormEvent<HTMLFormElement>, disputeId: string) => {
    event.preventDefault();
    if (!account) return;
    setSaving(true);
    setError(null);
    try {
      await addDisputeMessage(account.id, disputeId, reply[disputeId] ?? '');
      setReply((current) => ({ ...current, [disputeId]: '' }));
      await refresh();
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : 'Unable to add this message.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-4 border-t border-slate-100 pt-3">
      {error ? <p role="alert" className="mb-3 rounded-lg bg-red-50 p-2 text-xs text-red-800">{error}</p> : null}
      {!open ? (
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          <MessageSquareWarning size={14} className="mr-1.5" /> Raise a dispute
        </Button>
      ) : (
        <form onSubmit={(event) => void submitDispute(event)} className="space-y-2 rounded-xl bg-amber-50 p-3">
          <label className="block text-xs font-semibold text-slate-700">Reason
            <select value={reason} onChange={(event) => setReason(event.target.value as DisputeReason)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              {reasons.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-700">Describe the issue (10–4000 characters)
            <textarea required minLength={10} maxLength={4000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs font-semibold text-slate-700">Photos (optional, up to 5; JPG, PNG or WebP; 5 MB each)
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => {
              const selected = Array.from(event.target.files ?? []);
              if (selected.length > 5) {
                setError('Select no more than five photos.');
                setPhotos([]);
                event.target.value = '';
                return;
              }
              if (selected.some((photo) => !['image/jpeg', 'image/png', 'image/webp'].includes(photo.type) || photo.size > 5 * 1024 * 1024)) {
                setError('Each photo must be JPG, PNG, or WebP and no larger than 5 MB.');
                setPhotos([]);
                event.target.value = '';
                return;
              }
              setError(null);
              setPhotos(selected);
            }} className="mt-1 block w-full text-xs" />
          </label>
          {photos.length ? <p className="text-xs text-slate-600">{photos.length} photo(s) selected.</p> : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>{saving ? 'Submitting…' : 'Submit dispute'}</Button>
            <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}
      {disputes.map((dispute) => (
        <article key={dispute.id} className="mt-3 rounded-xl border border-amber-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{reasons.find((item) => item.value === dispute.reason)?.label ?? dispute.reason.replace('_', ' ')}</p>
            <Badge tone={statusTone(dispute.status)}>{dispute.status.replace('_', ' ')}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">{dispute.description}</p>
          <DisputePhotoGallery paths={dispute.photoPaths} />
          {dispute.resolutionNotes ? <p className="mt-2 text-xs text-slate-600">Resolution: {dispute.resolution?.replace('_', ' ')} · {dispute.resolutionNotes}</p> : null}
          <div className="mt-3 space-y-2">
            {dispute.messages.map((message) => (
              <p key={message.id} className={`rounded-lg p-2 text-xs ${message.senderId === account?.id ? 'ml-4 bg-emerald-50 text-emerald-950' : 'mr-4 bg-slate-100 text-slate-800'}`}>
                {message.message}<span className="mt-1 block text-[10px] opacity-60">{new Date(message.createdAt).toLocaleString('en-IN')}</span>
              </p>
            ))}
          </div>
          {dispute.status === 'open' || dispute.status === 'under_review' ? (
            <form onSubmit={(event) => void submitReply(event, dispute.id)} className="mt-3 flex gap-2">
              <label className="sr-only" htmlFor={`dispute-reply-${dispute.id}`}>Reply to dispute</label>
              <input id={`dispute-reply-${dispute.id}`} value={reply[dispute.id] ?? ''} onChange={(event) => setReply((current) => ({ ...current, [dispute.id]: event.target.value }))} maxLength={4000} placeholder="Add a message…" className="min-w-0 flex-1 rounded-full border border-slate-300 px-3 py-2 text-xs" />
              <Button type="submit" size="sm" disabled={saving || !(reply[dispute.id] ?? '').trim()} aria-label="Send dispute message"><Send size={14} /></Button>
            </form>
          ) : null}
        </article>
      ))}
    </section>
  );
}

function DisputePhotoGallery({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.all(paths.map((path) => getDisputePhotoUrl(path))).then((photoUrls) => {
      if (active) setUrls(photoUrls);
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load dispute photos.');
    });
    return () => { active = false; };
  }, [paths]);
  if (!paths.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {urls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Dispute evidence ${index + 1}`} className="h-16 w-16 rounded-lg border border-slate-200 object-cover" /></a>)}
      {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
