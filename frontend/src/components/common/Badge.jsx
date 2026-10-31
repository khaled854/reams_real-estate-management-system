import clsx from 'clsx';

/**
 * Badge
 * Variants: primary | secondary | success | warning | danger | info | dark | outline
 * Sizes:    sm | md (default) | lg
 * dot:      boolean — shows a colored dot before the label
 */
const variantMap = {
  primary:   'badge-primary',
  secondary: 'badge-secondary',
  success:   'badge-success',
  warning:   'badge-warning',
  danger:    'badge-danger',
  info:      'badge-info',
  dark:      'badge-dark',
  outline:   'badge-outline border-current',
};

const sizeMap = {
  sm: 'text-2xs px-2 py-0.5',
  md: '',   // default from .badge class
  lg: 'text-sm px-3 py-1',
};

const dotColorMap = {
  primary:   'bg-primary-800',
  secondary: 'bg-secondary-500',
  success:   'bg-success',
  warning:   'bg-warning',
  danger:    'bg-danger',
  info:      'bg-info',
  dark:      'bg-dark-600',
  outline:   'bg-current',
};

function Badge({ children, variant = 'primary', size = 'md', dot = false, className }) {
  return (
    <span
      className={clsx(
        'badge',
        variantMap[variant] ?? variantMap.primary,
        sizeMap[size],
        className
      )}
    >
      {dot && (
        <span
          className={clsx('w-1.5 h-1.5 rounded-full shrink-0', dotColorMap[variant])}
        />
      )}
      {children}
    </span>
  );
}

export default Badge;
