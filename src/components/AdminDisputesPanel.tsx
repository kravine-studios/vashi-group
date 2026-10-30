import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  Package,
  PhoneCall,
  Send,
  ShieldCheck,
  Store,
  User,
  Warehouse,
} from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { formatCurrency } from '../lib/formatters';
import {
  addDisputeMessage,
  disputeReasonLabels,
  getDisputePhotoUrl,
  listDisputes,
  updateDispute,
  type DisputeParticipant,
  type DisputeRecord,
  type DisputeResolution,
  type DisputeStatus,
} from '../services/disputes';
import { Badge } from './Badge';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

const statusToneMap: Record<DisputeStatus, 'warning' | 'info' | 'success' | 'danger'> = {
  open: 'warning',
  under_review: 'info',
  resolved: 'success',
  rejected: 'danger',
};

export function AdminDisputesPanel({
  onOpenCountChange,
  sectionId,
}: {
  onOpenCountChange: (count: number) => void;
  sectionId?: string;
}) {
  const { account } = useAuth();
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [sendingMessageId, setSendingMessageId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [quickReplies, setQuickReplies] = useState<Record<string, string>>({});
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
      onOpenCountChange(
        loaded.filter((dispute) => dispute.status === 'open' || dispute.status === 'under_review').length,
      );
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
    const resolution =
      status === 'resolved' || status === 'rejected' ? resolutions[dispute.id] ?? 'dismissed' : null;
    const resolutionNotes = status === 'resolved' || status === 'rejected' ? notes[dispute.id] ?? '' : null;
    setSavingId(dispute.id);
    setError(null);
    setNotice(null);
    try {
      if (!account) throw new Error('An admin account is required to arbitrate disputes.');
      await updateDispute(
        account,
        dispute.id,
        status,
        resolution,
        resolutionNotes,
        messages[dispute.id] ?? '',
      );
      setNotice(`Dispute #${dispute.id.slice(0, 8).toUpperCase()} updated and parties notified.`);
      setMessages((curr) => ({ ...curr, [dispute.id]: '' }));
      await refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update this dispute.');
    } finally {
      setSavingId(null);
    }
  };

  const handleSendThreadMessage = async (disputeId: string) => {
    const text = (quickReplies[disputeId] ?? '').trim();
    if (!text || !account) return;
    setSendingMessageId(disputeId);
    setError(null);
    try {
      await addDisputeMessage(account.id, disputeId, text);
      setQuickReplies((curr) => ({ ...curr, [disputeId]: '' }));
      setNotice(`Mediation message sent. All parties notified in real time.`);
      await refresh();
    } catch (msgError) {
      setError(msgError instanceof Error ? msgError.message : 'Unable to send message.');
    } finally {
      setSendingMessageId(null);
    }
  };

  const filteredDisputes = useMemo(() => {
    return disputes.filter((dispute) => {
      if (statusFilter !== 'all' && dispute.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      const raisedBy = dispute.raisedByParty?.businessName?.toLowerCase() ?? '';
      const against = dispute.againstParty?.businessName?.toLowerCase() ?? '';
      const orderId = dispute.orderId.toLowerCase();
      const dispId = dispute.id.toLowerCase();
      const desc = dispute.description.toLowerCase();
      return (
        orderId.includes(q) ||
        dispId.includes(q) ||
        raisedBy.includes(q) ||
        against.includes(q) ||
        desc.includes(q)
      );
    });
  }, [disputes, statusFilter, search]);

  const openCount = disputes.filter((d) => d.status === 'open' || d.status === 'under_review').length;
  const resolvedCount = disputes.filter((d) => d.status === 'resolved' || d.status === 'rejected').length;

  return (
    <section id={sectionId} className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-card md:p-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800 uppercase tracking-wider">
              <ShieldCheck size={13} className="text-red-700" /> APMC Arbitration Desk
            </span>
          </div>
          <h2 className="mt-1.5 text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Dispute Management & Mediation
            <span className="text-xs font-semibold text-slate-500 ml-2">
              ({openCount} active investigation{openCount === 1 ? '' : 's'} · {resolvedCount} closed)
            </span>
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            Transparent dispute handling between retailers and wholesalers with multi-party communication threads and audit logs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => void refresh()} disabled={loading}>
            Refresh Disputes
          </Button>
        </div>
      </header>

      {/* Filter and stats toolbar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-1">Status:</span>
          {(['all', 'open', 'under_review', 'resolved', 'rejected'] as const).map((tab) => (
            <button
              type="button"
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition capitalize ${
                statusFilter === tab
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {tab === 'all'
                ? `All (${disputes.length})`
                : tab === 'open'
                  ? `Open (${disputes.filter((d) => d.status === 'open').length})`
                  : tab === 'under_review'
                    ? `Under Review (${disputes.filter((d) => d.status === 'under_review').length})`
                    : tab === 'resolved'
                      ? `Resolved (${disputes.filter((d) => d.status === 'resolved').length})`
                      : `Rejected (${disputes.filter((d) => d.status === 'rejected').length})`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label htmlFor="dispute-search" className="sr-only">
            Search disputes
          </label>
          <input
            id="dispute-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search party, order #, or issue..."
            className="w-full sm:w-64 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          />
        </div>
      </div>

      {error ? (
        <div role="alert" className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-800">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800">
          {notice}
        </div>
      ) : null}

      {loading ? (
        <p className="py-12 text-center text-xs font-semibold text-slate-500">Loading disputes and conversation records…</p>
      ) : null}

      {!loading && !filteredDisputes.length ? (
        <EmptyState
          title="No disputes found"
          description={
            search || statusFilter !== 'all'
              ? 'No disputes match your current search or status filter.'
              : 'All kirana transactions are operating smoothly without active conflicts.'
          }
        />
      ) : null}

      {!loading && filteredDisputes.length ? (
        <div className="space-y-6">
          {filteredDisputes.map((dispute) => (
            <DetailedDisputeCard
              key={dispute.id}
              dispute={dispute}
              saving={savingId === dispute.id}
              sendingMessage={sendingMessageId === dispute.id}
              resolution={resolutions[dispute.id] ?? dispute.resolution ?? 'dismissed'}
              onResolutionChange={(res) => setResolutions((curr) => ({ ...curr, [dispute.id]: res }))}
              resolutionNotes={notes[dispute.id] ?? dispute.resolutionNotes ?? ''}
              onNotesChange={(text) => setNotes((curr) => ({ ...curr, [dispute.id]: text }))}
              adminReply={messages[dispute.id] ?? ''}
              onAdminReplyChange={(text) => setMessages((curr) => ({ ...curr, [dispute.id]: text }))}
              quickReplyText={quickReplies[dispute.id] ?? ''}
              onQuickReplyChange={(text) => setQuickReplies((curr) => ({ ...curr, [dispute.id]: text }))}
              onSave={(e) => void save(e, dispute)}
              onSendQuickMessage={() => void handleSendThreadMessage(dispute.id)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DetailedDisputeCard({
  dispute,
  saving,
  sendingMessage,
  resolution,
  onResolutionChange,
  resolutionNotes,
  onNotesChange,
  adminReply,
  onAdminReplyChange,
  quickReplyText,
  onQuickReplyChange,
  onSave,
  onSendQuickMessage,
}: {
  dispute: DisputeRecord;
  saving: boolean;
  sendingMessage: boolean;
  resolution: DisputeResolution;
  onResolutionChange: (res: DisputeResolution) => void;
  resolutionNotes: string;
  onNotesChange: (text: string) => void;
  adminReply: string;
  onAdminReplyChange: (text: string) => void;
  quickReplyText: string;
  onQuickReplyChange: (text: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onSendQuickMessage: () => void;
}) {
  const reasonLabel = disputeReasonLabels[dispute.reason] ?? dispute.reason.replace(/_/g, ' ');
  const statusTone = statusToneMap[dispute.status] ?? 'warning';

  const raisedBy = dispute.raisedByParty;
  const against = dispute.againstParty;
  const hasSubOrderItems = Boolean(dispute.subOrderItems && dispute.subOrderItems.length > 0);

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300">
      {/* 1. Header: Dispute Reference, Reason Badge, Status */}
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-extrabold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
              #{dispute.id.slice(0, 8).toUpperCase()}
            </span>
            <span className="text-slate-400">·</span>
            <span className="rounded-md bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900 flex items-center gap-1">
              <AlertTriangle size={12} className="text-amber-700" />
              {reasonLabel}
            </span>
            <Badge tone={statusTone} dot>
              {dispute.status.replace(/_/g, ' ')}
            </Badge>
          </div>

          <p className="mt-1.5 text-xs text-slate-500 font-medium">
            Raised on{' '}
            {new Date(dispute.createdAt).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            · Related to Order <span className="font-mono font-bold text-slate-700">#{dispute.orderId.slice(0, 8).toUpperCase()}</span>
            {dispute.subOrderId ? (
              <> · Stall Sub-Order <span className="font-mono font-bold text-slate-700">#{dispute.subOrderId.slice(0, 8).toUpperCase()}</span></>
            ) : null}
          </p>
        </div>

        <div className="text-right">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Escrow Value at Stake</p>
          <p className="font-mono text-lg font-black text-emerald-800">
            {formatCurrency(dispute.subOrderAmount ?? dispute.orderAmount ?? 0)}
          </p>
        </div>
      </header>

      {/* 2. Visual "Who Raised Dispute" vs "Against Whom" Comparison Grid */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {/* Raised By (Claimant) */}
        <PartyCard
          title="Claimant · Who Raised Dispute"
          roleBadgeTone="warning"
          party={raisedBy}
          fallbackRole="Retailer"
          isClaimant
        />

        {/* Against Whom (Respondent) */}
        <PartyCard
          title="Respondent · Against Whom"
          roleBadgeTone="info"
          party={against}
          fallbackRole="Wholesaler"
          isClaimant={false}
        />
      </div>

      {/* 3. Disputed Commodities Breakdown Table (if available) */}
      {hasSubOrderItems ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200/80">
            <Package size={14} className="text-slate-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Affected Sub-Order Commodities
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                  <th className="pb-1.5">Commodity</th>
                  <th className="pb-1.5 text-center">Grade</th>
                  <th className="pb-1.5 text-right">Quantity</th>
                  <th className="pb-1.5 text-right">Rate</th>
                  <th className="pb-1.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 font-medium text-slate-800">
                {dispute.subOrderItems?.map((item) => (
                  <tr key={item.productId}>
                    <td className="py-1.5 font-bold text-slate-900">{item.name}</td>
                    <td className="py-1.5 text-center">
                      <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold">
                        {item.grade ? `Grade ${item.grade}` : 'Standard'}
                      </span>
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-1.5 text-right font-mono text-slate-600">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="py-1.5 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* 4. Issue Description & Evidence Photos */}
      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
          Statement & Claim Submitted by {raisedBy?.businessName ?? 'Claimant'}:
        </p>
        <p className="mt-1 text-xs sm:text-sm text-slate-800 leading-relaxed font-medium whitespace-pre-wrap">
          {dispute.description}
        </p>
        <AdminDisputePhotos paths={dispute.photoPaths} />
      </div>

      {/* 5. Transparent Mediation Discussion Thread (All Parties In Loop) */}
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-emerald-700" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Transparent Mediation Thread
            </h4>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">
            Visible to Retailer, Wholesaler & Admin
          </span>
        </div>

        {/* Message bubble stream */}
        <div className="mt-3 space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {!dispute.messages.length ? (
            <p className="text-xs text-slate-500 italic py-2">
              No replies on this thread yet. Send a mediation message below to contact both parties.
            </p>
          ) : (
            dispute.messages.map((message) => {
              const isAdmin = message.senderRole === 'super_admin' || message.senderId === 'demo-admin';
              const isWholesaler = message.senderRole === 'wholesaler';

              return (
                <div
                  key={message.id}
                  className={`rounded-xl p-3 text-xs leading-relaxed ${
                    isAdmin
                      ? 'bg-slate-900 text-white ml-3 sm:ml-8 border border-slate-800'
                      : isWholesaler
                        ? 'bg-sky-50 text-sky-950 mr-3 sm:mr-8 border border-sky-200'
                        : 'bg-emerald-50 text-emerald-950 mr-3 sm:mr-8 border border-emerald-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <span
                      className={`inline-block font-extrabold uppercase text-[10px] px-2 py-0.5 rounded-md ${
                        isAdmin
                          ? 'bg-slate-700 text-emerald-300'
                          : isWholesaler
                            ? 'bg-sky-200 text-sky-900'
                            : 'bg-emerald-200 text-emerald-900'
                      }`}
                    >
                      {isAdmin
                        ? '🛡️ APMC Platform Admin'
                        : isWholesaler
                          ? `🏬 Wholesaler: ${message.senderName ?? 'Wholesaler'}`
                          : `🏪 Retailer: ${message.senderName ?? 'Retailer'}`}
                    </span>
                    <span className={`text-[10px] ${isAdmin ? 'text-slate-400' : 'text-slate-500'}`}>
                      {new Date(message.createdAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap font-medium">{message.message}</p>
                </div>
              );
            })
          )}
        </div>

        {/* Quick Admin mediation reply form */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2">
          <label htmlFor={`quick-reply-${dispute.id}`} className="sr-only">
            Post mediation message
          </label>
          <input
            id={`quick-reply-${dispute.id}`}
            value={quickReplyText}
            onChange={(e) => onQuickReplyChange(e.target.value)}
            maxLength={4000}
            placeholder="Post mediation message to Retailer & Wholesaler thread (notifies both parties)..."
            className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSendQuickMessage();
              }
            }}
          />
          <Button
            size="sm"
            onClick={onSendQuickMessage}
            disabled={sendingMessage || !quickReplyText.trim()}
            className="text-xs font-bold"
          >
            <Send size={13} className="mr-1" />
            {sendingMessage ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </div>

      {/* 6. Admin Arbitration & Resolution Form */}
      <form
        onSubmit={onSave}
        className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 grid gap-3 md:grid-cols-2"
      >
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Update Dispute Status
            <select
              name="status"
              defaultValue={dispute.status}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-600"
            >
              <option value="open">Open (Awaiting Initial Investigation)</option>
              <option value="under_review">Under Review (Parties in Active Discussion)</option>
              <option value="resolved">Resolved (Arbitration Decision Accepted)</option>
              <option value="rejected">Rejected (Claim Dismissed / Invalid)</option>
            </select>
          </label>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Resolution Action (Required for Resolved / Rejected)
            <select
              value={resolution}
              onChange={(e) => onResolutionChange(e.target.value as DisputeResolution)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-600"
            >
              <option value="refund">Refund (Credit back to Retailer wallet/escrow)</option>
              <option value="replacement">Replacement (Wholesaler re-ships / swaps goods)</option>
              <option value="dismissed">Dismissed (Wholesaler released; claim invalid)</option>
            </select>
          </label>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Official Resolution Decision Notes (Shared with both parties)
            <textarea
              rows={2}
              value={resolutionNotes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="State the arbitration findings, agreed compensation or reason for decision..."
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-900 outline-none focus:border-emerald-600"
            />
          </label>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Optional Decision Message on Thread
            <textarea
              rows={2}
              value={adminReply}
              onChange={(e) => onAdminReplyChange(e.target.value)}
              maxLength={4000}
              placeholder="Post a concluding directive or next steps to the thread..."
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-900 outline-none focus:border-emerald-600"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 md:col-span-2 border-t border-slate-200">
          <span className="text-[11px] font-semibold text-slate-500">
            {dispute.status === 'open' || dispute.status === 'under_review' ? (
              <span className="text-amber-800 font-bold">
                ⚠️ Wholesaler escrow payout is locked until resolution.
              </span>
            ) : (
              <span className="text-emerald-800 font-bold flex items-center gap-1">
                <CheckCircle2 size={13} /> Dispute settled and recorded in admin audit ledger.
              </span>
            )}
          </span>
          <Button type="submit" size="sm" disabled={saving} className="font-bold text-xs">
            {saving ? 'Updating…' : 'Save Arbitration Decision & Notify Parties'}
          </Button>
        </div>
      </form>
    </article>
  );
}

function PartyCard({
  title,
  roleBadgeTone,
  party,
  fallbackRole,
  isClaimant,
}: {
  title: string;
  roleBadgeTone: 'warning' | 'info';
  party?: DisputeParticipant;
  fallbackRole: string;
  isClaimant: boolean;
}) {
  const isWholesaler = party?.role === 'wholesaler';

  return (
    <div
      className={`rounded-2xl border p-4 shadow-2xs ${
        isClaimant ? 'border-amber-200 bg-amber-50/40' : 'border-sky-200 bg-sky-50/40'
      }`}
    >
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200/70">
        <div className="flex items-center gap-1.5">
          {isWholesaler ? (
            <Warehouse size={15} className="text-blue-700" />
          ) : (
            <Store size={15} className="text-emerald-700" />
          )}
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">{title}</span>
        </div>
        <Badge tone={roleBadgeTone}>
          {(party?.role ?? fallbackRole).toUpperCase()}
        </Badge>
      </div>

      <div className="mt-3 space-y-1.5 text-xs">
        <p className="text-base font-extrabold text-slate-900 leading-tight">
          {party?.businessName || `${fallbackRole} Business`}
        </p>

        <p className="text-slate-600 flex items-center gap-1">
          <span className="font-semibold text-slate-500">Location:</span>
          <span>{party?.shopNumber ? `Stall / Shop ${party.shopNumber}` : 'APMC Mandi Yard'}</span>
        </p>

        <p className="text-slate-700 flex items-center gap-1.5 font-medium">
          <User size={13} className="text-slate-400 shrink-0" />
          <span>Contact: <strong>{party?.contactName || 'Manager on Record'}</strong></span>
        </p>

        {party?.contactPhone ? (
          <div className="pt-1.5">
            <a
              href={`tel:${party.contactPhone}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-3 py-1.5 font-bold text-emerald-800 hover:bg-emerald-50 transition shadow-2xs"
            >
              <PhoneCall size={12} className="text-emerald-700" />
              <span>Call: {party.contactPhone}</span>
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AdminDisputePhotos({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    void Promise.all(paths.map((path) => getDisputePhotoUrl(path))).then((photoUrls) => {
      if (active) setUrls(photoUrls);
    });
    return () => {
      active = false;
    };
  }, [paths]);

  if (!urls.length) return null;

  return (
    <div className="mt-3 pt-3 border-t border-amber-200/60">
      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-900 mb-2">
        Attached Evidence Photos ({urls.length})
      </p>
      <div className="flex flex-wrap gap-2">
        {urls.map((url, index) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noreferrer"
            title="Click to view full photo evidence"
            className="group relative block overflow-hidden rounded-xl border border-amber-300 shadow-2xs transition hover:scale-105"
          >
            <img src={url} alt={`Dispute evidence ${index + 1}`} className="h-16 w-16 object-cover" />
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        ))}
      </div>
    </div>
  );
}
