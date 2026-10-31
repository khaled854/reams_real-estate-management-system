import { forwardRef } from 'react';
import clsx from 'clsx';
import Spinner from './Spinner';

/**
 * Button
 * Variants: primary | secondary | outline | outline-secondary | ghost | danger | white
 * Sizes:    xs | sm | md (default) | lg | xl
 */
const variantMap = {
  primary:           'btn-primary',
  secondary:         'btn-secondary',
  outline:           'btn-outline',
  'outline-secondary': 'btn-outline-secondary',
  ghost:             'btn-ghost',
  danger:            'btn-danger',
  white:             'btn-white',
};

const sizeMap = {
  xs: 'btn-xs',
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
  xl: 'btn-xl',
};

const Button = forwardRef(function Button(
  {
    children,
    variant  = 'primary',
    size     = 'md',
    loading  = false,
    disabled = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    className,
    type = 'button',
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'btn',
        variantMap[variant] ?? variantMap.primary,
        sizeMap[size]       ?? sizeMap.md,
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading ? (
        <Spinner
          size="sm"
          color={['primary', 'secondary', 'danger'].includes(variant) ? 'white' : 'primary'}
        />
      ) : (
        leftIcon && <span className="shrink-0">{leftIcon}</span>
      )}
      {children}
      {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
});

export default Button;
