import { forwardRef } from 'react';
import clsx from 'clsx';

/**
 * Textarea
 * Multi-line text input aligned with Input styles.
 */
const Textarea = forwardRef(function Textarea(
  {
    label,
    hint,
    error,
    rows = 4,
    className,
    containerClass,
    id,
    required,
    showCount = false,
    maxLength,
    value,
    ...props
  },
  ref
) {
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={clsx('w-full', containerClass)}>
      {label && (
        <label htmlFor={textareaId} className="form-label">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}

      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        required={required}
        aria-invalid={!!error}
        maxLength={maxLength}
        value={value}
        className={clsx(
          'input-base resize-y min-h-[6rem]',
          error && 'input-error',
          className
        )}
        {...props}
      />

      <div className="flex justify-between items-start mt-1">
        <div>
          {error && <p className="form-error" role="alert">{error}</p>}
          {!error && hint && <p className="form-hint">{hint}</p>}
        </div>
        {showCount && maxLength && (
          <span className="text-xs text-dark-400 shrink-0 ml-2">
            {(value || '').length}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
});

export default Textarea;
