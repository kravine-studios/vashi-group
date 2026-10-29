import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ArrowLeft, CheckCircle2, ShieldCheck, Store, Warehouse } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

const registrationSchema = z.object({
  role: z.enum(['retailer', 'wholesaler']),
  businessName: z.string().trim().min(2, 'Enter your business name.'),
  address: z.string().trim().min(5, 'Enter your business address.'),
  gstNumber: z.string().trim().toUpperCase().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Enter a valid 15-character GSTIN.'),
  fssaiNumber: z.string().trim().regex(/^\d{14}$/, 'FSSAI number must contain exactly 14 digits.'),
  shopNumber: z.string().trim().min(1, 'Enter your office or shop number.'),
  contactName: z.string().trim().min(2, 'Enter a contact name.'),
  contactPhone: z.string().trim().regex(/^[+]?[\d\s()-]{8,20}$/, 'Enter a valid contact phone number.'),
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

type RegistrationValues = z.infer<typeof registrationSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const { signUp, error, clearError } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationRequired, setConfirmationRequired] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { role: 'retailer' },
  });

  const selectedRole = watch('role');

  const submit = async (values: RegistrationValues) => {
    setFormError(null);
    clearError();
    try {
      const result = await signUp({
        ...values,
        gstNumber: values.gstNumber.toUpperCase(),
      });
      if (result.confirmationRequired) {
        setConfirmationRequired(true);
      } else {
        navigate('/account');
      }
    } catch (registrationError) {
      setFormError(registrationError instanceof Error ? registrationError.message : 'Unable to submit registration.');
    }
  };

  if (confirmationRequired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 sm:p-6 font-sans">
        <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-card text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={32} />
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-emerald-700">Verification Pending</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900">Check Your Email</h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-600">
            We sent a verification link to your business email. Confirm your email, then sign in to check your account review status.
          </p>
          <div className="mt-6">
            <Link
              to="/login"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-emerald-700 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-900 shadow-xs transition"
            >
              Go to sign in
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 font-sans">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-card md:p-8">
        <Link
          to="/login"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft size={14} /> Back to sign in
        </Link>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-emerald-800 border border-emerald-200">
            <ShieldCheck size={13} className="text-emerald-600" /> APMC Verification Required
          </span>
        </div>
        <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Register Wholesale Business
        </h1>
        <p className="mb-6 mt-1 text-xs sm:text-sm text-slate-600">
          New kirana stores and APMC mandi stalls are reviewed by marketplace admin before trading.
        </p>

        <form onSubmit={handleSubmit(submit)} className="space-y-6">
          <fieldset>
            <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">Select Business Type</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${selectedRole === 'retailer' ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600' : 'border-slate-200 hover:bg-slate-50'
                }`}>
                <input type="radio" value="retailer" {...register('role')} className="mt-1 h-4 w-4 text-emerald-700" />
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                    <Store size={16} className="text-emerald-700" /> Kirana Retailer
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600">Buying staples in bulk from wholesale stalls</p>
                </div>
              </label>

              <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${selectedRole === 'wholesaler' ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600' : 'border-slate-200 hover:bg-slate-50'
                }`}>
                <input type="radio" value="wholesaler" {...register('role')} className="mt-1 h-4 w-4 text-emerald-700" />
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                    <Warehouse size={16} className="text-emerald-700" /> APMC Wholesaler
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600">Selling mandi commodities to verified stores</p>
                </div>
              </label>
            </div>
            {errors.role ? <p role="alert" className="mt-1.5 text-xs font-semibold text-red-700">{errors.role.message}</p> : null}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Company / Shop Name" autoComplete="organization" placeholder="e.g. Laxmi Kirana Stores" {...register('businessName')} error={errors.businessName?.message} />
            <Input label="Shop / Office Number" placeholder="e.g. Stall B-42, APMC Market 2" {...register('shopNumber')} error={errors.shopNumber?.message} />
            <div className="sm:col-span-2">
              <Input label="Business Address" autoComplete="street-address" placeholder="Full address with pin code" {...register('address')} error={errors.address?.message} />
            </div>
            <Input label="GST Number (15 chars)" autoCapitalize="characters" placeholder="27AAAAA0000A1Z5" {...register('gstNumber')} error={errors.gstNumber?.message} />
            <Input label="FSSAI Number (14 digits)" inputMode="numeric" placeholder="10012345678901" {...register('fssaiNumber')} error={errors.fssaiNumber?.message} />
            <Input label="Contact Person" autoComplete="name" placeholder="Full name" {...register('contactName')} error={errors.contactName?.message} />
            <Input label="Contact Phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210" {...register('contactPhone')} error={errors.contactPhone?.message} />
            <Input label="Business Email" type="email" autoComplete="email" placeholder="contact@business.in" {...register('email')} error={errors.email?.message} />
            <Input label="Account Password" type="password" autoComplete="new-password" placeholder="At least 8 characters" {...register('password')} error={errors.password?.message} />
          </div>

          {formError || error ? (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
              {formError ?? error}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <Link to="/login" className="text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900">
              I already have an account
            </Link>
            <Button type="submit" size="lg" className="min-h-[48px] text-sm font-bold" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting registration…' : 'Submit for Verification'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
