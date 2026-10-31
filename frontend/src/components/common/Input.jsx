import { forwardRef } from 'react';
import clsx from 'clsx';

/**
 * Input
 * Fully accessible text input with optional prefix/suffix icons,
 * error state, success state, hint text, and label.
 *
 * Usage:
 *   <Input label="Email" type="email" placeholder="you@company.com" />
 *   <Input error="Required" value={val} onChange={...} />
 *   <Input prefix={<SearchIcon />} />
 */
const Input = forwardRef(function Input(
  {
    label,
    hint,
    error,
    success,
    prefix,       // icon/element left inside the input
    suffix,       // icon/element right inside the input
    prefixText,   // text label left outside (e.g. "https://")
    suffixText,   // text label right outside
    className,
    containerClass,
    id,
    required,
    ...props
  },
  ref
) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={clsx('w-full', containerClass)}>
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}

      <div className="flex">
        {/* Left external text (e.g., "https://") */}
        {prefixText && (
          <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-dark-200 bg-dark-50 text-dark-500 text-sm whitespace-nowrap">
            {prefixText}
          </span>
        )}

        <div className={clsx('relative flex-1', prefixText && 'rounded-l-none', suffixText && 'rounded-r-none')}>
          {/* Left icon */}
          {prefix && (
            <span className="absolute inset-y-0 left-3 flex items-center text-dark-400 pointer-events-none">
              {prefix}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            required={required}
            aria-invalid={!!error}
            aria-describedby={
              error   ? `${inputId}-error`   :
              hint    ? `${inputId}-hint`    : undefined
            }
            className={clsx(
              'input-base',
              prefix  && 'pl-10',
              suffix  && 'pr-10',
              prefixText && '!rounded-l-none',
              suffixText && '!rounded-r-none',
              error   && 'input-error',
              success && 'input-success',
              className
            )}
            {...props}
          />

          {/* Right icon */}
          {suffix && (
            <span className="absolute inset-y-0 right-3 flex items-center text-dark-400 pointer-events-none">
              {suffix}
            </span>
          )}
        </div>

        {/* Right external text */}
        {suffixText && (
          <span className="inline-flex items-center px-3 rounded-r-lg border border-l-0 border-dark-200 bg-dark-50 text-dark-500 text-sm whitespace-nowrap">
            {suffixText}
          </span>
        )}
      </div>

      {error && (
        <p id={`${inputId}-error`} className="form-error" role="alert">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${inputId}-hint`} className="form-hint">
          {hint}
        </p>
      )}
    </div>
  );
});

export default Input;
