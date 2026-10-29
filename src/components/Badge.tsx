import type { ReactNode } from 'react';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  dot?: boolean;
};

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-800 border border-slate-200',
  success: 'bg-emerald-50 text-emerald-900 border border-emerald-300',
  warning: 'bg-amber-50 text-amber-900 border border-amber-300',
  danger: 'bg-red-50 text-red-900 border border-red-300',
  info: 'bg-sky-50 text-sky-900 border border-sky-300',
};

const dotClasses: Record<BadgeTone, string> = {
  neutral: 'bg-slate-500',
  success: 'bg-emerald-600',
  warning: 'bg-amber-600',
  danger: 'bg-red-600',
  info: 'bg-sky-600',
};

export function Badge({ children, tone = 'neutral', className = '', dot = false }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${toneClasses[tone]} ${className}`}>
      {dot ? <span className={`h-1.5 w-1.5 rounded-full ${dotClasses[tone]}`} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
