import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-emerald-700 text-white hover:bg-emerald-900 active:scale-[0.98] shadow-sm focus-visible:ring-emerald-600 focus-visible:ring-offset-2',
  secondary: 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 hover:border-slate-400 active:scale-[0.98] focus-visible:ring-emerald-600 focus-visible:ring-offset-2',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-emerald-600 focus-visible:ring-offset-2',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] shadow-sm focus-visible:ring-red-600 focus-visible:ring-offset-2',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3.5 py-1.5 text-xs sm:text-sm min-h-[36px] rounded-lg',
  md: 'px-4 py-2.5 text-sm min-h-[44px] rounded-xl',
  lg: 'px-6 py-3 text-base min-h-[48px] rounded-xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 select-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
