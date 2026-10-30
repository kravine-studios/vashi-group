import type { AccountProfile, RegistrationDetails, Role } from '../types';
import { addDemoNotification } from './demoNotifications';

type DemoAccount = {
  id: string;
  email: string;
  password: string;
  account: AccountProfile;
};

const accountsKey = 'kirana-demo-accounts';
const sessionKey = 'kirana-demo-session';
const adminAuditKey = 'kirana-demo-admin-audit';

const makeAccount = (
  id: string,
  email: string,
  role: Role,
  status: AccountProfile['status'],
  businessName: string,
  profileCompleted: boolean,
): DemoAccount => ({
  id,
  email,
  password: 'demo1234',
  account: {
    id,
    email,
    role,
    status,
    profileCompleted,
    rejectionReason: null,
    approvalNoticePending: false,
    businessName,
    address: 'Sector 19, Vashi, Navi Mumbai',
    gstNumber: '27ABCDE1234F1Z5',
    fssaiNumber: '12345678901234',
    shopNumber: 'Shop 12',
    contactName: role === 'retailer' ? 'Priya Shah' : 'Amit Patel',
    contactPhone: '9876543210',
    logoPath: null,
  },
});

const initialAccounts = (): DemoAccount[] => [
  makeAccount('demo-admin', 'admin@kirana.local', 'super_admin', 'approved', 'Kirana Operations', true),
  makeAccount('demo-retailer', 'retailer@kirana.local', 'retailer', 'approved', 'Shah Kirana Mart', true),
  makeAccount('demo-wholesaler', 'wholesaler@kirana.local', 'wholesaler', 'approved', 'Vashi Grain House', true),
];

const readAccounts = (): DemoAccount[] => {
  const saved = localStorage.getItem(accountsKey);
  if (!saved) {
    const accounts = initialAccounts();
    localStorage.setItem(accountsKey, JSON.stringify(accounts));
    return accounts;
  }
  const parsed: unknown = JSON.parse(saved);
  if (!Array.isArray(parsed)) throw new Error('Demo account data is invalid. Clear the kirana-demo-accounts browser storage key.');
  return parsed as DemoAccount[];
};

const writeAccounts = (accounts: DemoAccount[]) => {
  localStorage.setItem(accountsKey, JSON.stringify(accounts));
};

export const demoSession = {
  currentAccount(): AccountProfile | null {
    const id = localStorage.getItem(sessionKey);
    if (!id) return null;
    return readAccounts().find((user) => user.id === id)?.account ?? null;
  },

  signIn(email: string, password: string): AccountProfile {
    const user = readAccounts().find((record) => record.email.toLowerCase() === email.toLowerCase());
    if (!user || user.password !== password) throw new Error('Email or password is incorrect.');
    localStorage.setItem(sessionKey, user.id);
    return user.account;
  },

  signInAs(role: Role): AccountProfile {
    const user = readAccounts().find((record) => record.account.role === role);
    if (!user) throw new Error(`No demo account is available for ${role}.`);
    localStorage.setItem(sessionKey, user.id);
    return user.account;
  },

  signUp(email: string, password: string, details: RegistrationDetails): AccountProfile {
    const accounts = readAccounts();
    if (accounts.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('An account with this email already exists.');
    }

    const id = crypto.randomUUID();
    const account: AccountProfile = {
      id,
      email,
      role: details.role,
      status: 'pending',
      profileCompleted: false,
      rejectionReason: null,
      approvalNoticePending: false,
      businessName: details.businessName,
      address: details.address,
      gstNumber: details.gstNumber,
      fssaiNumber: details.fssaiNumber,
      shopNumber: details.shopNumber ?? '',
      contactName: details.contactName,
      contactPhone: details.contactPhone,
      logoPath: null,
    };
    writeAccounts([...accounts, { id, email, password, account }]);
    accounts.filter((user) => user.account.role === 'super_admin' && user.account.status === 'approved')
      .forEach((admin) => addDemoNotification(
        admin.id,
        'registration_submitted',
        'New registration',
        `New ${details.role} awaiting approval: ${details.businessName}`,
        { user_id: id },
      ));
    localStorage.setItem(sessionKey, id);
    return account;
  },

  pendingAccounts(): AccountProfile[] {
    return readAccounts().map((user) => user.account).filter((account) => account.status === 'pending');
  },

  listAccounts(): AccountProfile[] {
    return readAccounts().map((user) => user.account);
  },

  setAccountStatus(id: string, status: 'approved' | 'suspended', reason: string): void {
    const accounts = readAccounts();
    const user = accounts.find((record) => record.id === id);
    if (!user || user.account.role === 'super_admin'
      || status === 'suspended' && user.account.status !== 'approved'
      || status === 'approved' && user.account.status !== 'suspended') {
      throw new Error('This account cannot be changed from the current status.');
    }
    if (status === 'suspended' && reason.trim().length < 5) throw new Error('Enter a suspension reason of at least five characters.');
    const before = user.account.status;
    user.account = { ...user.account, status, rejectionReason: null };
    writeAccounts(accounts);
    const savedAudit = localStorage.getItem(adminAuditKey);
    const audit = savedAudit ? JSON.parse(savedAudit) as DemoAdminAudit[] : [];
    if (!Array.isArray(audit)) throw new Error('Saved demo audit log is invalid.');
    const event: DemoAdminAudit = {
      action: status === 'suspended' ? 'account_suspended' : 'account_reinstated',
      details: { userId: id, before, after: status, reason: reason.trim() || null },
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(adminAuditKey, JSON.stringify([event, ...audit]));
  },

  deleteAccount(id: string): void {
    const accounts = readAccounts();
    const user = accounts.find((record) => record.id === id);
    if (!user || user.account.role === 'super_admin') {
      throw new Error('This account cannot be deleted.');
    }
    const filtered = accounts.filter((record) => record.id !== id);
    writeAccounts(filtered);
    const savedAudit = localStorage.getItem(adminAuditKey);
    const audit = savedAudit ? (JSON.parse(savedAudit) as DemoAdminAudit[]) : [];
    const event: DemoAdminAudit = {
      action: 'account_deleted',
      details: { userId: id, email: user.email, businessName: user.account.businessName },
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(adminAuditKey, JSON.stringify([event, ...(Array.isArray(audit) ? audit : [])]));
  },

  recordAdminAudit(action: string, details: Record<string, unknown>): void {
    const savedAudit = localStorage.getItem(adminAuditKey);
    const audit = savedAudit ? JSON.parse(savedAudit) as DemoAdminAudit[] : [];
    if (!Array.isArray(audit)) throw new Error('Saved demo audit log is invalid.');
    localStorage.setItem(adminAuditKey, JSON.stringify([
      { action, details, createdAt: new Date().toISOString() },
      ...audit,
    ]));
  },

  auditEntries(): DemoAdminAudit[] {
    const savedAudit = localStorage.getItem(adminAuditKey);
    const audit = savedAudit ? JSON.parse(savedAudit) as DemoAdminAudit[] : [];
    if (!Array.isArray(audit)) throw new Error('Saved demo audit log is invalid.');
    return audit;
  },

  reviewAccount(id: string, approve: boolean, reason: string): AccountProfile[] {
    const accounts = readAccounts();
    const user = accounts.find((record) => record.id === id);
    if (!user || user.account.status !== 'pending') throw new Error('Only pending accounts can be reviewed.');
    if (!approve && !reason.trim()) throw new Error('A rejection reason is required.');

    user.account = {
      ...user.account,
      status: approve ? 'approved' : 'rejected',
      rejectionReason: approve ? null : reason.trim(),
      approvalNoticePending: approve,
    };
    writeAccounts(accounts);
    this.recordAdminAudit(approve ? 'registration_approved' : 'registration_rejected', {
      userId: id,
      reason: approve ? null : reason.trim(),
    });
    addDemoNotification(
      id,
      approve ? 'registration_approved' : 'registration_rejected',
      approve ? 'Registration approved' : 'Registration rejected',
      approve ? 'You have been successfully registered in this community.' : `Registration rejected: ${reason.trim()}`,
      { user_id: id, status: approve ? 'approved' : 'rejected' },
    );
    return accounts.map((record) => record.account).filter((account) => account.status === 'pending');
  },

  consumeApprovalNotice(id: string): boolean {
    const accounts = readAccounts();
    const user = accounts.find((record) => record.id === id);
    if (!user?.account.approvalNoticePending) return false;
    user.account = { ...user.account, approvalNoticePending: false };
    writeAccounts(accounts);
    return true;
  },

  completeProfile(
    accountHolder: string,
    branchName: string,
    accountNumber: string,
    ifsc: string,
    logoPath: string | null,
  ): AccountProfile {
    const id = localStorage.getItem(sessionKey);
    const accounts = readAccounts();
    const user = accounts.find((record) => record.id === id);
    if (!user || user.account.status !== 'approved') throw new Error('An approved account is required.');
    if (!accountHolder.trim()) throw new Error('Account holder name is required.');
    if (!branchName.trim()) throw new Error('Branch name is required.');
    if (!/^\d{8,20}$/.test(accountNumber)) throw new Error('Account number must contain 8–20 digits.');
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.trim().toUpperCase())) throw new Error('Enter a valid IFSC code.');
    user.account = {
      ...user.account,
      profileCompleted: true,
      logoPath: logoPath ?? user.account.logoPath,
    };
    writeAccounts(accounts);
    return user.account;
  },

  signOut(): void {
    localStorage.removeItem(sessionKey);
  },
};

export type DemoAdminAudit = {
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
};

export const mockDemoPassword = 'demo1234';
