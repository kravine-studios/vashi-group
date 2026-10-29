import { createContext } from 'react';
import type { AccountProfile, RegistrationDetails, Role } from '../types';

export type RegistrationInput = RegistrationDetails & { email: string; password: string };
export type ProfileCompletionInput = {
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
  logo: File;
};

export type AuthContextValue = {
  account: AccountProfile | null;
  pendingAccounts: AccountProfile[];
  loading: boolean;
  error: string | null;
  approvalNotice: boolean;
  clearError: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signInDemo: (role: Role) => void;
  signUp: (input: RegistrationInput) => Promise<{ confirmationRequired: boolean }>;
  signOut: () => Promise<void>;
  completeProfile: (input: ProfileCompletionInput) => Promise<void>;
  reviewAccount: (id: string, approve: boolean, reason: string) => Promise<void>;
  dismissApprovalNotice: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
