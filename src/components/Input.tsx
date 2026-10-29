import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  leadingAdornment?: ReactNode;
  trailingAdornment?: ReactNode;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({
  id,
  label,
  hint,
  error,
  leadingAdornment,
  trailingAdornment,
  className = '',
  ...props
}, ref) {
  const generatedId = useId();
  const inputId = id ?? props.name ?? generatedId;
  const hintId = hint && inputId ? `${inputId}-hint` : undefined;
  const errorId = error && inputId ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-semibold text-slate-800">
        {label}
      </label>
      <div className="relative">
        {leadingAdornment ? (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500" aria-hidden="true">
            {leadingAdornment}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={`w-full min-h-[44px] rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${leadingAdornment ? 'pl-10' : ''} ${trailingAdornment ? 'pr-10' : ''} ${error ? 'border-red-500 bg-red-50/20' : 'border-slate-300'} ${className}`}
          {...props}
        />
        {trailingAdornment ? (
          <span className="absolute inset-y-0 right-3 flex items-center text-slate-500">
            {trailingAdornment}
          </span>
        ) : null}
      </div>
      {hint ? <p id={hintId} className="text-xs text-slate-600">{hint}</p> : null}
      {error ? <p id={errorId} role="alert" className="text-xs font-semibold text-red-700">{error}</p> : null}
    </div>
  );
});
