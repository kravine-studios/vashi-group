import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { ProfileCompletionModal } from '../components/ProfileCompletionModal';

export function AccountPage() {
  const navigate = useNavigate();
  const { account, loading, signOut, error: authError } = useAuth();
  const [signOutError, setSignOutError] = useState<string | null>(null);

  useEffect(() => {
    if (account?.status === 'approved' && account.profileCompleted) {
      const destination =
        account.role === 'super_admin'
          ? '/admin'
          : account.role === 'wholesaler'
            ? '/wholesaler'
            : '/retailer';
      navigate(destination, { replace: true });
    }
  }, [account, navigate]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs font-semibold text-slate-800">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
          Loading account profile…
        </div>
      </main>
    );
  }

  if (!account) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs text-center">
          <p className="font-bold text-slate-900">No signed-in session found.</p>
          <Button onClick={() => navigate('/login')} className="mt-4 min-h-[44px]">Return to Sign in</Button>
        </div>
      </main>
    );
  }

  const exit = async () => {
    setSignOutError(null);
    try {
      await signOut();
      navigate('/login');
    } catch (logoutError) {
      setSignOutError(logoutError instanceof Error ? logoutError.message : 'Unable to sign out.');
    }
  };

  if (account.status === 'approved' && account.profileCompleted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 font-semibold text-slate-800">
        Redirecting to your wholesale portal…
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 sm:p-6 font-sans">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-card">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Business Profile</span>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900">{account.businessName}</h1>
            <p className="text-xs text-slate-600">{account.email}</p>
          </div>
          <Badge tone={account.status === 'approved' ? 'success' : account.status === 'pending' ? 'warning' : 'danger'} dot>
            {account.status.toUpperCase()}
          </Badge>
        </div>

        {authError || signOutError ? (
          <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
            {signOutError ?? authError}
          </div>
        ) : null}

        {account.status === 'pending' ? (
          <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
            <div className="flex items-start gap-3">
              <Clock size={22} className="text-amber-700 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-extrabold text-sm sm:text-base">Mandi Verification Under Review</h2>
                <p className="mt-1 text-xs text-amber-900 leading-relaxed">
                  Your business documents (GSTIN & FSSAI) are being reviewed by APMC marketplace administration. Full wholesale access unlocks automatically once approved.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {account.status === 'rejected' ? (
          <div className="mt-6 rounded-2xl border border-red-300 bg-red-50 p-5 text-red-950">
            <div className="flex items-start gap-3">
              <AlertCircle size={22} className="text-red-700 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-extrabold text-sm sm:text-base">Registration Not Approved</h2>
                <p className="mt-1 text-xs text-red-900">
                  {account.rejectionReason || 'Document details did not match APMC records. Please contact marketplace support for assistance.'}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {account.status === 'suspended' ? (
          <div className="mt-6 rounded-2xl border border-red-300 bg-red-50 p-5 text-red-950">
            <div className="flex items-start gap-3">
              <ShieldAlert size={22} className="text-red-700 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-extrabold text-sm sm:text-base">Trading Account Suspended</h2>
                <p className="mt-1 text-xs text-red-900">
                  Marketplace ordering and token redemptions are paused. Please contact marketplace operations.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {account.status === 'approved' && !account.profileCompleted ? (
          <div className="mt-6 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={22} className="text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-extrabold text-sm sm:text-base">Verification Approved!</h2>
                <p className="mt-1 text-xs text-emerald-900 leading-relaxed">
                  Please complete the remaining stall or shop address details in the modal dialog to unlock your marketplace trading.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">Role: {account.role.replace('_', ' ')}</span>
          <Button variant="secondary" size="sm" onClick={() => void exit()} className="min-h-[40px]">
            Sign out
          </Button>
        </div>
      </section>
      <ProfileCompletionModal />
    </main>
  );
}
