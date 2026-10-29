import { useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, Clock3, ShieldCheck, Truck, X } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { TransportSchedulePanel } from '../components/TransportSchedulePanel';
import { AdminDisputesPanel } from '../components/AdminDisputesPanel';
import { AdminOperationsPanel } from '../components/AdminOperationsPanel';

export function AdminPage() {
  const { pendingAccounts, reviewAccount, error: authError } = useAuth();
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);
  const [upcomingSlots, setUpcomingSlots] = useState<number | null>(null);
  const [openDisputes, setOpenDisputes] = useState<number | null>(null);
  const [ordersToday, setOrdersToday] = useState<number | null>(null);

  const review = async (id: string, approve: boolean) => {
    setActionError(null);
    setBusyAccountId(id);
    try {
      await reviewAccount(id, approve, rejectionReasons[id] ?? '');
      setRejectionReasons((current) => ({ ...current, [id]: '' }));
    } catch (reviewError) {
      setActionError(reviewError instanceof Error ? reviewError.message : 'Unable to update registration.');
    } finally {
      setBusyAccountId(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-3 sm:p-6 md:p-8 font-sans">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Admin Header */}
        <header className="rounded-3xl bg-slate-900 p-6 text-white shadow-card sm:p-8">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-800/80 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-emerald-200">
              <ShieldCheck size={13} className="text-emerald-400" /> APMC Operations Console
            </span>
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Marketplace Operations
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-300">
            Review GSTIN/FSSAI business approvals, manage truck schedules, arbitrate disputes, and monitor daily volume.
          </p>
        </header>

        {/* High-Contrast Operations Stats */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Pending Registrations"
            value={String(pendingAccounts.length).padStart(2, '0')}
            icon={<Clock3 size={20} className="text-amber-700" />}
            bg="bg-amber-50 border-amber-200"
          />
          <StatCard
            label="Orders Settled Today"
            value={ordersToday === null ? '—' : String(ordersToday).padStart(2, '0')}
            icon={<ClipboardList size={20} className="text-purple-700" />}
            bg="bg-purple-50 border-purple-200"
          />
          <StatCard
            label="Active Disputes"
            value={openDisputes === null ? '—' : String(openDisputes).padStart(2, '0')}
            icon={<AlertTriangle size={20} className="text-red-700" />}
            bg="bg-red-50 border-red-200"
          />
          <StatCard
            label="Scheduled Truck Slots"
            value={upcomingSlots === null ? '—' : String(upcomingSlots).padStart(2, '0')}
            icon={<Truck size={20} className="text-sky-700" />}
            bg="bg-sky-50 border-sky-200"
          />
        </div>

        {/* Registration Approval Queue */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">Registration Verification Queue</h2>
              <p className="text-xs text-slate-600">Cross-check GSTIN and FSSAI license numbers before granting access.</p>
            </div>
            <Badge tone={pendingAccounts.length ? 'warning' : 'success'} dot>
              {pendingAccounts.length} Pending Approvals
            </Badge>
          </div>

          {actionError || authError ? (
            <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
              {actionError ?? authError}
            </div>
          ) : null}

          {pendingAccounts.length === 0 ? (
            <EmptyState
              title="Verification queue is all clear"
              description="New retailer and wholesaler registrations submitted will appear here for review."
            />
          ) : (
            <div className="space-y-4">
              {pendingAccounts.map((candidate) => (
                <article key={candidate.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">{candidate.businessName}</h3>
                      <p className="text-xs text-slate-700">
                        {candidate.contactName} · <a href={`mailto:${candidate.email}`} className="font-semibold text-emerald-700 hover:underline">{candidate.email}</a>
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Address: {candidate.address} · Shop/Stall: {candidate.shopNumber}
                      </p>
                    </div>
                    <Badge tone="neutral" className="uppercase font-bold tracking-wider">
                      {candidate.role}
                    </Badge>
                  </div>

                  <div className="mt-3 grid gap-2 rounded-xl bg-white p-3 border border-slate-200 text-xs text-slate-800 sm:grid-cols-3">
                    <p><span className="font-bold text-slate-600">GSTIN:</span> <strong className="font-mono text-slate-900">{candidate.gstNumber}</strong></p>
                    <p><span className="font-bold text-slate-600">FSSAI:</span> <strong className="font-mono text-slate-900">{candidate.fssaiNumber}</strong></p>
                    <p><span className="font-bold text-slate-600">Contact:</span> <strong className="text-slate-900">{candidate.contactPhone}</strong></p>
                  </div>

                  <label className="mt-3 block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Rejection Reason (required only if rejecting)
                    <textarea
                      rows={2}
                      placeholder="e.g. Invalid GSTIN or address mismatch"
                      value={rejectionReasons[candidate.id] ?? ''}
                      onChange={(event) => setRejectionReasons((current) => ({ ...current, [candidate.id]: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-emerald-600"
                    />
                  </label>

                  <div className="mt-3 flex justify-end gap-2 pt-2 border-t border-slate-200/60">
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busyAccountId === candidate.id || !(rejectionReasons[candidate.id] ?? '').trim()}
                      onClick={() => void review(candidate.id, false)}
                      className="min-h-[38px] text-xs font-bold"
                    >
                      <X size={14} className="mr-1" /> Reject Application
                    </Button>
                    <Button
                      size="sm"
                      disabled={busyAccountId === candidate.id}
                      onClick={() => void review(candidate.id, true)}
                      className="min-h-[38px] text-xs font-bold"
                    >
                      <CheckCircle2 size={14} className="mr-1" /> Approve Business
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <TransportSchedulePanel onCountChange={setUpcomingSlots} />
        <AdminDisputesPanel onOpenCountChange={setOpenDisputes} />
        <AdminOperationsPanel onOrdersToday={setOrdersToday} />
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
  bg,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  bg: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 shadow-2xs ${bg}`}>
      <div className="mb-2.5 inline-flex rounded-xl bg-white p-2 shadow-2xs">{icon}</div>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-900 font-mono">{value}</p>
    </div>
  );
}
