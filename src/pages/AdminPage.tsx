import { useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, Clock3, ShieldCheck, Store, Truck, Warehouse, X } from 'lucide-react';

function scrollToSection(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
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
            onClick={() => scrollToSection('registration-queue')}
          />
          <StatCard
            label="Orders Settled Today"
            value={ordersToday === null ? '—' : String(ordersToday).padStart(2, '0')}
            icon={<ClipboardList size={20} className="text-purple-700" />}
            bg="bg-purple-50 border-purple-200"
            onClick={() => scrollToSection('platform-controls')}
          />
          <StatCard
            label="Active Disputes"
            value={openDisputes === null ? '—' : String(openDisputes).padStart(2, '0')}
            icon={<AlertTriangle size={20} className="text-red-700" />}
            bg="bg-red-50 border-red-200"
            onClick={() => scrollToSection('dispute-management')}
          />
          <StatCard
            label="Scheduled Truck Slots"
            value={upcomingSlots === null ? '—' : String(upcomingSlots).padStart(2, '0')}
            icon={<Truck size={20} className="text-sky-700" />}
            bg="bg-sky-50 border-sky-200"
            onClick={() => scrollToSection('transport-schedule')}
          />
        </div>

        {/* Registration Approval Queue */}
        <section id="registration-queue" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
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
                <article key={candidate.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5 shadow-xs">
                  {/* Business Header with Name and Email labels */}
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-200/80">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                        {candidate.role === 'wholesaler' ? <Warehouse size={20} /> : <Store size={20} />}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Name:</span>
                          <h3 className="text-base sm:text-lg font-black text-slate-900">{candidate.businessName}</h3>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-700">
                          <span className="font-bold text-slate-500">Email:</span>
                          <a href={`mailto:${candidate.email}`} className="font-semibold text-emerald-700 hover:underline">
                            {candidate.email}
                          </a>
                        </div>
                      </div>
                    </div>
                    <Badge tone="neutral" className="uppercase font-bold tracking-wider text-xs px-3 py-1">
                      {candidate.role}
                    </Badge>
                  </div>

                  {/* Clean Structured Details Grid with Clear Labels */}
                  <div className="mt-3.5 grid gap-3 rounded-xl bg-white p-4 border border-slate-200 text-xs text-slate-800 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <span className="font-bold text-slate-500 text-[11px] uppercase tracking-wider block">Contact Person:</span>
                      <strong className="text-slate-900 text-sm font-semibold">{candidate.contactName}</strong>
                    </div>

                    <div>
                      <span className="font-bold text-slate-500 text-[11px] uppercase tracking-wider block">Contact Phone:</span>
                      <strong className="text-slate-900 text-sm font-semibold">
                        <a href={`tel:${candidate.contactPhone}`} className="hover:text-emerald-700 transition">
                          {candidate.contactPhone}
                        </a>
                      </strong>
                    </div>

                    <div>
                      <span className="font-bold text-slate-500 text-[11px] uppercase tracking-wider block">Shop / Stall Number:</span>
                      <strong className="text-slate-900 text-sm font-semibold">
                        {candidate.shopNumber || 'Not specified (Optional)'}
                      </strong>
                    </div>

                    <div className="sm:col-span-2 lg:col-span-3">
                      <span className="font-bold text-slate-500 text-[11px] uppercase tracking-wider block">Business Address:</span>
                      <p className="text-slate-800 text-xs font-medium mt-0.5">{candidate.address}</p>
                    </div>

                    <div>
                      <span className="font-bold text-slate-500 text-[11px] uppercase tracking-wider block">GSTIN:</span>
                      <strong className="font-mono text-slate-900 text-xs font-bold tracking-wider bg-slate-50 px-2 py-0.5 rounded border border-slate-200 inline-block mt-0.5">
                        {candidate.gstNumber}
                      </strong>
                    </div>

                    <div>
                      <span className="font-bold text-slate-500 text-[11px] uppercase tracking-wider block">FSSAI Number:</span>
                      <strong className="font-mono text-slate-900 text-xs font-bold tracking-wider bg-slate-50 px-2 py-0.5 rounded border border-slate-200 inline-block mt-0.5">
                        {candidate.fssaiNumber}
                      </strong>
                    </div>

                    <div>
                      <span className="font-bold text-slate-500 text-[11px] uppercase tracking-wider block">Business Role:</span>
                      <span className="font-bold text-slate-900 uppercase text-xs inline-block mt-1">
                        {candidate.role}
                      </span>
                    </div>
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

        <TransportSchedulePanel onCountChange={setUpcomingSlots} sectionId="transport-schedule" />
        <AdminDisputesPanel onOpenCountChange={setOpenDisputes} sectionId="dispute-management" />
        <AdminOperationsPanel onOrdersToday={setOrdersToday} sectionId="platform-controls" />
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
  bg,
  onClick,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  bg: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={`w-full rounded-2xl border p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:shadow-sm ${bg}`}>
      <div className="mb-2.5 inline-flex rounded-xl bg-white p-2 shadow-2xs">{icon}</div>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-900 font-mono">{value}</p>
    </button>
  );
}
