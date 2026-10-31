import { forwardRef } from 'react';
import clsx from 'clsx';

/**
 * Select
 * Native <select> styled to match the design system.
 *
 * Usage:
 *   <Select label="Status" options={[{ value: 'active', label: 'Active' }]} />
 */
const Select = forwardRef(function Select(
  {
    label,
    hint,
    error,
    options = [],
    placeholder = 'Select an option',
    className,
    containerClass,
    id,
    required,
    ...props
  },
  ref
) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={clsx('w-full', containerClass)}>
      {label && (
        <label htmlFor={selectId} className="form-label">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          required={required}
          aria-invalid={!!error}
          className={clsx(
            'input-base appearance-none pr-9 cursor-pointer',
            error && 'input-error',
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Chevron */}
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-dark-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {!error && hint && <p className="form-hint">{hint}</p>}
    </div>
  );
});

export default Select;
