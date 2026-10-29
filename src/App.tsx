import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { ClipboardList, LogOut, ShieldCheck, ShoppingBag, Store, UserCheck, Warehouse } from 'lucide-react';
import { useAuth } from './auth/useAuth';
import { useCart } from './cart/useCart';
import { Button } from './components/Button';
import { Toast } from './components/Toast';
import { NotificationCenter } from './components/NotificationCenter';
import { AccountPage } from './pages/AccountPage';
import { AdminPage } from './pages/AdminPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { RetailerPage } from './pages/RetailerPage';
import { WholesalerProfilePage } from './pages/WholesalerProfilePage';
import { WholesalerPage } from './pages/WholesalerPage';
import { CartPage } from './pages/CartPage';
import type { Role } from './types';

export default function App() {
  const { account, loading, signOut, approvalNotice, dismissApprovalNotice } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const logout = async () => {
    setSignOutError(null);
    try {
      await signOut();
      navigate('/login');
    } catch (logoutError) {
      setSignOutError(logoutError instanceof Error ? logoutError.message : 'Unable to sign out.');
    }
  };

  const isRetailerApproved = account?.role === 'retailer' && account.status === 'approved' && account.profileCompleted;
  const isWholesalerApproved = account?.role === 'wholesaler' && account.status === 'approved' && account.profileCompleted;
  const isAdminApproved = account?.role === 'super_admin' && account.status === 'approved';

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 pb-16 sm:pb-0">
      {account ? (
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-xs">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
            <Link
              to="/account"
              className="flex items-center gap-2 min-w-0 truncate rounded-lg p-1 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-900 font-bold text-xs uppercase">
                {account.businessName.slice(0, 2)}
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-bold text-slate-900 leading-tight">{account.businessName}</p>
                <p className="text-[11px] font-medium text-slate-600 capitalize">{account.role.replace('_', ' ')}</p>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav aria-label="Main navigation" className="hidden items-center gap-1.5 sm:flex">
              {isRetailerApproved ? (
                <>
                  <Link
                    to="/retailer"
                    className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${location.pathname === '/retailer'
                        ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-300'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                  >
                    <Store size={16} /> Marketplace
                  </Link>
                  <Link
                    to="/orders"
                    className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${location.pathname === '/orders'
                        ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-300'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                  >
                    <ClipboardList size={16} /> Orders
                  </Link>
                </>
              ) : null}
              {isWholesalerApproved ? (
                <Link
                  to="/wholesaler"
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${location.pathname === '/wholesaler'
                      ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-300'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                >
                  <Warehouse size={16} /> Orders & Products
                </Link>
              ) : null}
              {isAdminApproved ? (
                <Link
                  to="/admin"
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${location.pathname === '/admin'
                      ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-300'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                >
                  <ShieldCheck size={16} /> Admin Operations
                </Link>
              ) : null}
            </nav>

            <div className="flex shrink-0 items-center gap-2">
              <NotificationCenter />
              {isRetailerApproved ? (
                <Link
                  to="/cart"
                  className={`relative inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition min-h-[40px] ${location.pathname === '/cart'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
                    }`}
                >
                  <ShoppingBag size={17} />
                  <span className="hidden md:inline">Basket</span>
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-900 px-1.5 text-xs font-bold text-white">
                    {itemCount}
                  </span>
                </Link>
              ) : null}
              <Button size="sm" variant="ghost" className="hidden sm:inline-flex" onClick={() => void logout()}>
                <LogOut size={15} className="mr-1.5" /> Sign out
              </Button>
            </div>
          </div>
        </header>
      ) : null}

      {/* Floating Alerts */}
      {approvalNotice ? (
        <div className="fixed right-4 top-16 z-[60] w-[min(24rem,calc(100vw-2rem))]">
          <Toast
            variant="success"
            title="Account approved"
            message="Your business account is verified. You now have full wholesale ordering access."
            action={<button type="button" className="text-sm font-bold underline" onClick={dismissApprovalNotice}>Dismiss</button>}
          />
        </div>
      ) : null}
      {signOutError ? (
        <div className="fixed right-4 top-16 z-[60] w-[min(24rem,calc(100vw-2rem))]">
          <Toast variant="error" title="Sign out failed" message={signOutError} />
        </div>
      ) : null}

      <div className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={account ? <Navigate to="/account" replace /> : <LoginPage />} />
          <Route path="/register" element={account ? <Navigate to="/account" replace /> : <RegisterPage />} />
          <Route path="/account" element={loading ? <LoadingPage /> : account ? <AccountPage /> : <Navigate to="/login" replace />} />
          <Route path="/retailer" element={<RoleRoute role="retailer"><RetailerPage /></RoleRoute>} />
          <Route path="/cart" element={<RoleRoute role="retailer"><CartPage /></RoleRoute>} />
          <Route path="/orders" element={<RoleRoute role="retailer"><CartPage /></RoleRoute>} />
          <Route path="/wholesalers/:wholesalerId" element={<RoleRoute role="retailer"><WholesalerProfilePage /></RoleRoute>} />
          <Route path="/wholesaler" element={<RoleRoute role="wholesaler"><WholesalerPage /></RoleRoute>} />
          <Route path="/admin" element={<RoleRoute role="super_admin"><AdminPage /></RoleRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {/* Mobile Bottom Navigation Bar (375px touch ergonomic) */}
      {account && isRetailerApproved ? (
        <nav
          aria-label="Mobile bottom navigation"
          className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-slate-200 bg-white/95 px-2 backdrop-blur-lg sm:hidden shadow-sheet"
        >
          <Link
            to="/retailer"
            className={`flex flex-col items-center justify-center flex-1 py-1.5 text-xs font-semibold ${location.pathname === '/retailer' ? 'text-emerald-700' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <Store size={20} />
            <span className="mt-1">Catalog</span>
          </Link>
          <Link
            to="/orders"
            className={`flex flex-col items-center justify-center flex-1 py-1.5 text-xs font-semibold ${location.pathname === '/orders' ? 'text-emerald-700' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <ClipboardList size={20} />
            <span className="mt-1">Orders</span>
          </Link>
          <Link
            to="/cart"
            className={`relative flex flex-col items-center justify-center flex-1 py-1.5 text-xs font-semibold ${location.pathname === '/cart' ? 'text-emerald-700' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <div className="relative">
              <ShoppingBag size={20} />
              {itemCount > 0 ? (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-700 px-1 text-[10px] font-bold text-white">
                  {itemCount}
                </span>
              ) : null}
            </div>
            <span className="mt-1">Cart</span>
          </Link>
          <Link
            to="/account"
            className={`flex flex-col items-center justify-center flex-1 py-1.5 text-xs font-semibold ${location.pathname === '/account' ? 'text-emerald-700' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <UserCheck size={20} />
            <span className="mt-1">Account</span>
          </Link>
        </nav>
      ) : null}
    </div>
  );
}

function RoleRoute({ role, children }: { role: Role; children: ReactNode }) {
  const { account, loading } = useAuth();
  if (loading) return <LoadingPage />;
  if (!account) return <Navigate to="/login" replace />;
  if (account.status !== 'approved' || !account.profileCompleted) return <Navigate to="/account" replace />;
  if (account.role !== role) {
    const destinations: Record<Role, string> = {
      super_admin: '/admin',
      wholesaler: '/wholesaler',
      retailer: '/retailer',
    };
    return <Navigate to={destinations[account.role]} replace />;
  }
  return children;
}

function LoadingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
        <span className="font-semibold text-slate-800">Opening Vashi B2B Marketplace…</span>
      </div>
    </main>
  );
}
