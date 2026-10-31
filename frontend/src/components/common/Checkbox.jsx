import { forwardRef } from 'react';
import clsx from 'clsx';

/**
 * Checkbox
 * Accessible styled checkbox.
 *
 * Usage:
 *   <Checkbox label="I agree to the terms" checked={val} onChange={...} />
 */
const Checkbox = forwardRef(function Checkbox(
  { label, hint, error, className, id, ...props },
  ref
) {
  const checkId = id || (label ? `chk-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className="w-full">
      <label
        htmlFor={checkId}
        className={clsx(
          'inline-flex items-start gap-3 cursor-pointer select-none group',
          props.disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className="relative flex items-center justify-center mt-0.5 shrink-0">
          <input
            ref={ref}
            type="checkbox"
            id={checkId}
            className="sr-only peer"
            {...props}
          />
          {/* Custom checkbox box */}
          <span
            className={clsx(
              'w-4.5 h-4.5 rounded border-2 border-dark-300 bg-white',
              'peer-checked:bg-primary-800 peer-checked:border-primary-800',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-primary-800/25 peer-focus-visible:ring-offset-1',
              'transition-all duration-150',
              'flex items-center justify-center',
              'w-[18px] h-[18px]',
              className
            )}
          >
            <svg
              className="w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
              viewBox="0 0 12 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="1.5 5.5 4.5 8.5 10.5 1.5" />
            </svg>
          </span>
        </span>

        <span className="flex flex-col">
          {label && (
            <span className="text-sm font-medium text-dark-700">{label}</span>
          )}
          {hint && (
            <span className="text-xs text-dark-400 mt-0.5">{hint}</span>
          )}
        </span>
      </label>

      {error && <p className="form-error mt-1 ml-[30px]" role="alert">{error}</p>}
    </div>
  );
});

export default Checkbox;
