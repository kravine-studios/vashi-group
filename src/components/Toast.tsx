import type { ReactNode } from 'react';

type ToastProps = {
  title: string;
  message?: string;
  variant?: 'success' | 'error' | 'info';
  action?: ReactNode;
};

const styles = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  error: 'border-red-200 bg-red-50 text-red-950',
  info: 'border-sky-200 bg-sky-50 text-sky-950',
} as const;

export function Toast({ title, message, variant = 'info', action }: ToastProps) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`flex items-start justify-between gap-4 rounded-xl border p-4 shadow-card ${styles[variant]}`}
    >
      <div>
        <p className="font-semibold">{title}</p>
        {message ? <p className="mt-1 text-sm opacity-80">{message}</p> : null}
      </div>
      {action}
    </div>
  );
}
