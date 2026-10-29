import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthContext } from './AuthContext';
import type { AuthContextValue, ProfileCompletionInput, RegistrationInput } from './AuthContext';
import { appConfig, supabase } from '../lib/env';
import { demoSession } from '../services/demoAuth';
import type { AccountProfile, Role } from '../types';
import type { BusinessProfileRow, ProfileRow } from '../types/database';

const mapAccount = (profile: ProfileRow, business: BusinessProfileRow): AccountProfile => ({
  id: profile.id,
  email: profile.email,
  role: profile.role,
  status: profile.status,
  profileCompleted: profile.profile_completed,
  rejectionReason: profile.rejection_reason,
  approvalNoticePending: profile.approval_notice_pending,
  businessName: business.business_name,
  address: business.address,
  gstNumber: business.gst_number,
  fssaiNumber: business.fssai_number,
  shopNumber: business.shop_number ?? '',
  contactName: business.contact_name,
  contactPhone: business.contact_phone,
  logoPath: business.logo_path,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<AccountProfile | null>(() =>
    appConfig.supabaseConfigured ? null : demoSession.currentAccount(),
  );
  const [pendingAccounts, setPendingAccounts] = useState<AccountProfile[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(appConfig.supabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [approvalNotice, setApprovalNotice] = useState(false);

  const loadAccount = useCallback(async (userId: string): Promise<AccountProfile | null> => {
    if (!supabase) return null;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return null;

    const { data: business, error: businessError } = await supabase
      .from('business_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (businessError) throw businessError;

    return mapAccount(profile, business);
  }, []);

  const refreshPendingAccounts = useCallback(async () => {
    if (account?.role !== 'super_admin') return;
    if (!supabase) {
      setPendingAccounts(demoSession.pendingAccounts());
      return;
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (profilesError) throw profilesError;
    if (!profiles.length) {
      setPendingAccounts([]);
      return;
    }

    const { data: businesses, error: businessesError } = await supabase
      .from('business_profiles')
      .select('*')
      .in('user_id', profiles.map((profile) => profile.id));
    if (businessesError) throw businessesError;
    if (businesses.length !== profiles.length) {
      throw new Error('Some pending accounts are missing business details. Check the auth profile trigger and migration state.');
    }
    const businessByUser = new Map(businesses.map((business) => [business.user_id, business]));
    setPendingAccounts(profiles.map((profile) => {
      const business = businessByUser.get(profile.id);
      if (!business) throw new Error(`Business details are missing for account ${profile.id}.`);
      return mapAccount(profile, business);
    }));
  }, [account?.role]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let active = true;
    const applySession = (nextSession: Session | null) => {
      setSession(nextSession);
      if (!nextSession) setAccount(null);
    };

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      applySession(data.session);
    }).catch((sessionError: Error) => {
      if (active) setError(sessionError.message);
    }).finally(() => {
      if (active) setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user.id) {
      if (!appConfig.supabaseConfigured) setLoading(false);
      return;
    }

    const client = supabase;
    let active = true;
    setLoading(true);
    void loadAccount(session.user.id).then(async (loadedAccount) => {
      if (!active) return;
      setAccount(loadedAccount);
      if (loadedAccount?.approvalNoticePending) {
        const { data, error: noticeError } = await client.rpc('consume_approval_notice');
        if (noticeError) throw noticeError;
        if (data) setApprovalNotice(true);
        setAccount({ ...loadedAccount, approvalNoticePending: false });
      }
    }).catch((loadError: Error) => {
      if (active) setError(loadError.message);
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [loadAccount, session?.user.id]);

  useEffect(() => {
    void refreshPendingAccounts().catch((loadError: Error) => setError(loadError.message));
  }, [refreshPendingAccounts]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    if (!supabase) {
      const signedInAccount = demoSession.signIn(email, password);
      if (demoSession.consumeApprovalNotice(signedInAccount.id)) {
        setApprovalNotice(true);
        setAccount({ ...signedInAccount, approvalNoticePending: false });
      } else {
        setAccount(signedInAccount);
      }
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
  }, []);

  const signInDemo = useCallback((role: Role) => {
    if (appConfig.supabaseConfigured) throw new Error('Demo sign-in is only available without Supabase credentials.');
    setError(null);
    setAccount(demoSession.signInAs(role));
  }, []);

  const signUp = useCallback(async (input: RegistrationInput) => {
    setError(null);
    if (!supabase) {
      setAccount(demoSession.signUp(input.email, input.password, input));
      return { confirmationRequired: false };
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          role: input.role,
          business_name: input.businessName,
          address: input.address,
          gst_number: input.gstNumber,
          fssai_number: input.fssaiNumber,
          shop_number: input.shopNumber ?? '',
          contact_name: input.contactName,
          contact_phone: input.contactPhone,
        },
      },
    });
    if (signUpError) throw signUpError;
    if (data.session) setSession(data.session);
    return { confirmationRequired: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setSession(null);
    } else {
      demoSession.signOut();
    }
    setAccount(null);
    setPendingAccounts([]);
  }, []);

  const completeProfile = useCallback(async (input: ProfileCompletionInput) => {
    if (!account) throw new Error('Sign in before completing your profile.');
    if (!input.accountHolder.trim()) throw new Error('Account holder name is required.');
    if (!input.branchName.trim()) throw new Error('Branch name is required.');
    if (!supabase) {
      const accountNumber = input.accountNumber.replace(/\s/g, '');
      if (!/^\d{8,20}$/.test(accountNumber)) throw new Error('Account number must contain 8–20 digits.');
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(input.ifsc.trim().toUpperCase())) throw new Error('Enter a valid IFSC code.');
      const logoPath = input.logo ? `${account.id}/${input.logo.name}` : account.logoPath ?? null;
      setAccount(demoSession.completeProfile(
        input.accountHolder,
        input.branchName,
        accountNumber,
        input.ifsc,
        logoPath,
      ));
      return;
    }

    const normalizedAccountNumber = input.accountNumber.replace(/\s/g, '');
    if (!/^\d{8,20}$/.test(normalizedAccountNumber)) throw new Error('Account number must contain 8–20 digits.');
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(input.ifsc.trim().toUpperCase())) throw new Error('Enter a valid IFSC code.');

    let logoPath: string | null = account.logoPath;
    if (input.logo) {
      const fileExtension = input.logo.name.split('.').pop()?.toLowerCase();
      if (!fileExtension || !['jpg', 'jpeg', 'png', 'webp'].includes(fileExtension)) {
        throw new Error('Logo must be a JPG, PNG, or WebP image.');
      }
      if (input.logo.size > 5 * 1024 * 1024) throw new Error('Logo must be no larger than 5 MB.');

      logoPath = `${account.id}/${crypto.randomUUID()}.${fileExtension}`;
      const { error: uploadError } = await supabase.storage
        .from('profile-logos')
        .upload(logoPath, input.logo, { contentType: input.logo.type, upsert: false });
      if (uploadError) throw uploadError;
    }

    const { error: completionError } = await supabase.rpc('complete_my_profile', {
      account_holder_input: input.accountHolder.trim(),
      branch_name_input: input.branchName.trim(),
      account_number_input: normalizedAccountNumber,
      ifsc_input: input.ifsc.trim().toUpperCase(),
      logo_path_input: logoPath,
    });
    if (completionError) throw completionError;
    const refreshedAccount = await loadAccount(account.id);
    setAccount(refreshedAccount);
  }, [account, loadAccount]);

  const reviewAccount = useCallback(async (id: string, approve: boolean, reason: string) => {
    if (!account || account.role !== 'super_admin') throw new Error('Only a super admin can review registrations.');
    if (!approve && !reason.trim()) throw new Error('A rejection reason is required.');

    if (!supabase) {
      setPendingAccounts(demoSession.reviewAccount(id, approve, reason));
      return;
    }

    const { error: reviewError } = await supabase.rpc('review_registration', {
      target_user_id: id,
      approve,
      reason: approve ? null : reason.trim(),
    });
    if (reviewError) throw reviewError;
    await refreshPendingAccounts();
  }, [account, refreshPendingAccounts]);

  const dismissApprovalNotice = useCallback(() => setApprovalNotice(false), []);
  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthContextValue>(() => ({
    account,
    pendingAccounts,
    loading,
    error,
    approvalNotice,
    clearError,
    signIn,
    signInDemo,
    signUp,
    signOut,
    completeProfile,
    reviewAccount,
    dismissApprovalNotice,
  }), [
    account,
    pendingAccounts,
    loading,
    error,
    approvalNotice,
    clearError,
    signIn,
    signInDemo,
    signUp,
    signOut,
    completeProfile,
    reviewAccount,
    dismissApprovalNotice,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
