import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ArrowLeft, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuth } from '../auth/useAuth';
import { appConfig } from '../lib/env';
import type { Role } from '../types';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

type LoginValues = z.infer<typeof loginSchema>;

const demoRoles: { role: Role; label: string; email: string; note: string }[] = [
  { role: 'retailer', label: 'Kirana Retailer Demo', email: 'retailer@kirana.local', note: 'Buyer role' },
  { role: 'wholesaler', label: 'APMC Wholesaler Demo', email: 'wholesaler@kirana.local', note: 'Supplier stall' },
  { role: 'super_admin', label: 'Admin Ops Demo', email: 'admin@kirana.local', note: 'Marketplace admin' },
];

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signInDemo, error, clearError } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const submit = async ({ email, password }: LoginValues) => {
    setFormError(null);
    clearError();
    try {
      await signIn(email, password);
      navigate('/account');
    } catch (signInError) {
      setFormError(signInError instanceof Error ? signInError.message : 'Unable to sign in.');
    }
  };

  const demoLogin = (role: Role) => {
    setFormError(null);
    try {
      signInDemo(role);
      navigate('/account');
    } catch (signInError) {
      setFormError(signInError instanceof Error ? signInError.message : 'Unable to sign in.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-card">
        <div className="mb-6">
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft size={14} /> Back to homepage
          </Link>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-emerald-800 border border-emerald-200">
              <ShieldCheck size={13} className="text-emerald-600" /> Verified Access
            </span>
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Sign in to Marketplace
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            Use your approved GST/FSSAI business account to access wholesale inventory.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(submit)}>
          <Input
            label="Business Email"
            type="email"
            autoComplete="email"
            placeholder="shop@kirana.in"
            leadingAdornment={<Mail size={16} />}
            {...register('email')}
            error={errors.email?.message}
          />
          <Input
            label="Account Password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            leadingAdornment={<Lock size={16} />}
            {...register('password')}
            error={errors.password?.message}
          />

          {formError || error ? (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
              {formError ?? error}
            </div>
          ) : null}

          <div className="pt-2">
            <Button type="submit" size="lg" className="w-full min-h-[48px] text-sm font-bold shadow-sm" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in to Marketplace'}
            </Button>
          </div>
        </form>

        <p className="mt-6 border-t border-slate-100 pt-5 text-center text-xs sm:text-sm text-slate-600 font-medium">
          New kirana store or APMC stall?{' '}
          <Link to="/register" className="font-bold text-emerald-700 hover:text-emerald-900 hover:underline">
            Register your business
          </Link>
        </p>

        {!appConfig.supabaseConfigured ? (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
              <KeyRound size={14} className="text-emerald-700" />
              <span>Instant Demo Accounts</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-600">
              Click to test the marketplace flow immediately without signing up.
            </p>
            <div className="mt-3 grid gap-2">
              {demoRoles.map(({ role, label, note }) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => demoLogin(role)}
                  className="flex items-center justify-between rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-100 hover:border-slate-400 active:scale-[0.98] transition min-h-[40px]"
                >
                  <span>{label}</span>
                  <span className="text-[10px] font-semibold text-slate-500">{note}</span>
                </button>
              ))}
            </div>
            <p className="mt-2.5 text-[11px] text-slate-500 text-center font-mono">Password: demo1234</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
