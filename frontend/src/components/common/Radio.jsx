import { forwardRef } from 'react';
import clsx from 'clsx';

/**
 * Radio / RadioGroup
 *
 * Usage — single radio:
 *   <Radio label="Option A" name="choice" value="a" checked={val==='a'} onChange={...} />
 *
 * Usage — group:
 *   <RadioGroup
 *     label="Listing Type"
 *     name="type"
 *     value={val}
 *     onChange={setVal}
 *     options={[{ value: 'sale', label: 'For Sale' }, { value: 'rent', label: 'For Rent' }]}
 *   />
 */
export const Radio = forwardRef(function Radio(
  { label, hint, className, id, ...props },
  ref
) {
  const radioId = id || (label ? `radio-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <label
      htmlFor={radioId}
      className={clsx(
        'inline-flex items-start gap-3 cursor-pointer select-none',
        props.disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span className="relative mt-0.5 shrink-0">
        <input
          ref={ref}
          type="radio"
          id={radioId}
          className="sr-only peer"
          {...props}
        />
        <span
          className={clsx(
            'w-[18px] h-[18px] rounded-full border-2 border-dark-300 bg-white flex items-center justify-center',
            'peer-checked:border-primary-800',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-primary-800/25 peer-focus-visible:ring-offset-1',
            'transition-all duration-150',
            className
          )}
        >
          <span className="w-2 h-2 rounded-full bg-primary-800 opacity-0 peer-checked:opacity-100 scale-0 peer-checked:scale-100 transition-all duration-150" />
        </span>
      </span>

      <span className="flex flex-col">
        {label && <span className="text-sm font-medium text-dark-700">{label}</span>}
        {hint  && <span className="text-xs text-dark-400 mt-0.5">{hint}</span>}
      </span>
    </label>
  );
});

export function RadioGroup({
  label,
  name,
  value,
  onChange,
  options = [],
  error,
  hint,
  direction = 'vertical',
}) {
  return (
    <fieldset>
      {label && (
        <legend className="form-label mb-2">{label}</legend>
      )}
      <div
        className={clsx(
          'flex gap-3',
          direction === 'vertical' ? 'flex-col' : 'flex-row flex-wrap'
        )}
      >
        {options.map((opt) => (
          <Radio
            key={opt.value}
            name={name}
            value={opt.value}
            label={opt.label}
            hint={opt.hint}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            disabled={opt.disabled}
          />
        ))}
      </div>
      {error && <p className="form-error mt-1" role="alert">{error}</p>}
      {!error && hint && <p className="form-hint mt-1">{hint}</p>}
    </fieldset>
  );
}

export default Radio;
