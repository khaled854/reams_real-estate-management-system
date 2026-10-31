import clsx from 'clsx';

/**
 * Spinner
 * Sizes:  xs | sm | md | lg | xl
 * Colors: primary | white | secondary | dark
 */
const sizeMap = {
  xs: 'w-3 h-3 border',
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-[3px]',
  xl: 'w-12 h-12 border-4',
};

const colorMap = {
  primary:   'border-primary-800/20 border-t-primary-800',
  white:     'border-white/20 border-t-white',
  secondary: 'border-secondary-500/20 border-t-secondary-500',
  dark:      'border-dark-300 border-t-dark-700',
};

function Spinner({ size = 'md', color = 'primary', className }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={clsx(
        'block rounded-full animate-spin',
        sizeMap[size]  ?? sizeMap.md,
        colorMap[color] ?? colorMap.primary,
        className
      )}
    />
  );
}

export default Spinner;
