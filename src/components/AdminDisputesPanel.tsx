import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/useAuth';
import {
  listDisputes,
  updateDispute,
  type DisputeRecord,
  type DisputeResolution,
  type DisputeStatus,
  getDisputePhotoUrl,
} from '../services/disputes';
import { Badge } from './Badge';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

export function AdminDisputesPanel({ onOpenCountChange, sectionId }: { onOpenCountChange: (count: number) => void; sectionId?: string }) {
  const { account } = useAuth();
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [resolutions, setResolutions] = useState<Record<string, DisputeResolution>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const loaded = await listDisputes(account);
      setDisputes(loaded);
      onOpenCountChange(loaded.filter((dispute) => dispute.status === 'open' || dispute.status === 'under_review').length);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load disputes.');
    } finally {
      setLoading(false);
    }
  }, [account, onOpenCountChange]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async (event: FormEvent<HTMLFormElement>, dispute: DisputeRecord) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const status = String(formData.get('status')) as DisputeStatus;
    const resolution = status === 'resolved' || status === 'rejected'
      ? resolutions[dispute.id] ?? 'dismissed'
      : null;
    const resolutionNotes = status === 'resolved' || status === 'rejected' ? notes[dispute.id] ?? '' : null;
    setSavingId(dispute.id);
    setError(null);
    setNotice(null);
    try {
      if (!account) throw new Error('An admin account is required to manage disputes.');
      await updateDispute(account, dispute.id, status, resolution, resolutionNotes, messages[dispute.id] ?? '');
      setNotice(`Dispute #${dispute.id.slice(0, 8).toUpperCase()} updated.`);
      await refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update this dispute.');
    } finally {
      setSavingId(null);
    }
  };

  const openCount = disputes.filter((dispute) => dispute.status === 'open' || dispute.status === 'under_review').length;
  return (
    <section id={sectionId} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-card md:p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-xl font-bold">Dispute management</h2><p className="mt-1 text-sm text-slate-500">{openCount} open · {disputes.length} total</p></div>
        <Button size="sm" variant="secondary" onClick={() => void refresh()} disabled={loading}>Refresh</Button>
      </header>
      {error ? <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {notice ? <p role="status" className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}
      {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading disputes…</p> : null}
      {!loading && !disputes.length ? <EmptyState title="No disputes" description="Disputes raised by retailers or wholesalers will appear here." /> : null}
      {!loading ? (
        <div className="space-y-4">
          {disputes.map((dispute) => (
            <article key={dispute.id} className="rounded-xl border border-slate-200 p-4">
              <header className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{dispute.reason.replace(/_/g, ' ')} · Order #{dispute.orderId.slice(0, 8).toUpperCase()}</p>
                  <p className="text-xs text-slate-500">Raised {new Date(dispute.createdAt).toLocaleString('en-IN')} · {dispute.subOrderId ? `Sub-order #${dispute.subOrderId.slice(0, 8).toUpperCase()}` : 'Whole order'}</p>
                </div>
                <Badge tone={dispute.status === 'resolved' ? 'success' : dispute.status === 'rejected' ? 'danger' : 'warning'}>{dispute.status.replace('_', ' ')}</Badge>
              </header>
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{dispute.description}</p>
              <AdminDisputePhotos paths={dispute.photoPaths} />
              <div className="mt-3 space-y-2">
                {dispute.messages.map((message) => (
                  <p key={message.id} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                    <span className="font-semibold">{message.senderId === account?.id ? 'Admin' : 'Participant'}: </span>{message.message}
                    <span className="mt-1 block text-[11px] text-slate-400">{new Date(message.createdAt).toLocaleString('en-IN')}</span>
                  </p>
                ))}
              </div>
              <form onSubmit={(event) => void save(event, dispute)} className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">Status
                  <select name="status" defaultValue={dispute.status} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                    <option value="open">Open</option><option value="under_review">Under review</option><option value="resolved">Resolved</option><option value="rejected">Rejected</option>
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-700">Resolution (required when resolved/rejected)
                  <select value={resolutions[dispute.id] ?? dispute.resolution ?? 'dismissed'} onChange={(event) => setResolutions((current) => ({ ...current, [dispute.id]: event.target.value as DisputeResolution }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                    <option value="refund">Refund</option><option value="replacement">Replacement</option><option value="dismissed">Dismissed</option>
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-700 md:col-span-2">Resolution notes
                  <textarea rows={2} value={notes[dispute.id] ?? dispute.resolutionNotes ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [dispute.id]: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                </label>
                <label className="block text-xs font-semibold text-slate-700 md:col-span-2">Reply to thread
                  <textarea rows={2} value={messages[dispute.id] ?? ''} onChange={(event) => setMessages((current) => ({ ...current, [dispute.id]: event.target.value }))} maxLength={4000} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                </label>
                <div className="flex items-center justify-between gap-3 md:col-span-2">
                  {dispute.subOrderId ? <span className="text-xs text-slate-500">Affected payout is held while this dispute is open.</span> : <span className="text-xs text-slate-500">Whole-order disputes hold payouts for related sub-orders.</span>}
                  <Button type="submit" size="sm" disabled={savingId === dispute.id}>{savingId === dispute.id ? 'Saving…' : 'Save update'}</Button>
                </div>
              </form>
              {dispute.resolution === 'refund' ? <p className="mt-2 text-xs text-amber-800">Mock payout was cancelled. No real payment was refunded.</p> : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function AdminDisputePhotos({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    void Promise.all(paths.map((path) => getDisputePhotoUrl(path))).then((photoUrls) => {
      if (active) setUrls(photoUrls);
    });
    return () => { active = false; };
  }, [paths]);
  return urls.length ? (
    <div className="mt-3 flex flex-wrap gap-2">
      {urls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Dispute evidence ${index + 1}`} className="h-16 w-16 rounded-lg border border-slate-200 object-cover" /></a>)}
    </div>
  ) : null;
}
