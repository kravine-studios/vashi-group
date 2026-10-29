import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';

export function ProfileCompletionModal() {
  const navigate = useNavigate();
  const { account, completeProfile, signOut } = useAuth();
  const [accountHolder, setAccountHolder] = useState(account?.contactName ?? '');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [logo, setLogo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!logo) {
      setError('Upload a shop logo to continue.');
      return;
    }

    setSubmitting(true);
    try {
      await completeProfile({ accountHolder, accountNumber, ifsc, logo });
    } catch (completionError) {
      setError(completionError instanceof Error ? completionError.message : 'Unable to save profile details.');
    } finally {
      setSubmitting(false);
    }
  };

  const exitAccount = async () => {
    setSignOutError(null);
    try {
      await signOut();
      navigate('/login');
    } catch (logoutError) {
      setSignOutError(logoutError instanceof Error ? logoutError.message : 'Unable to sign out.');
    }
  };

  return (
    <Modal
      open={Boolean(account && account.status === 'approved' && !account.profileCompleted)}
      title="Complete your business profile"
      description="Bank details and your shop logo are required before you can list products or place orders."
      onClose={() => undefined}
      dismissible={false}
    >
      <form className="space-y-4" onSubmit={submit}>
        <Input label="Bank account holder" autoComplete="name" value={accountHolder} onChange={(event) => setAccountHolder(event.target.value)} required />
        <Input label="Bank account number" inputMode="numeric" autoComplete="off" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} required />
        <Input label="IFSC code" autoCapitalize="characters" value={ifsc} onChange={(event) => setIfsc(event.target.value.toUpperCase())} required />
        <Input
          label="Shop logo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => setLogo(event.target.files?.[0] ?? null)}
          required
        />
        {error || signOutError ? (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error ?? signOutError}</p>
        ) : null}
        <div className="flex justify-between pt-2">
          <Button type="button" variant="ghost" onClick={() => void exitAccount()}>Sign out</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save and continue'}</Button>
        </div>
      </form>
    </Modal>
  );
}
