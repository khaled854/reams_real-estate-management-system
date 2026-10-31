import clsx from 'clsx';

/**
 * Avatar
 * src:     image URL (optional — falls back to initials)
 * name:    used to generate initials fallback
 * size:    xs | sm | md | lg | xl | 2xl
 * shape:   circle (default) | square
 * status:  online | offline | away | busy (optional dot indicator)
 */
const sizeMap = {
  xs:  'w-6 h-6 text-2xs',
  sm:  'w-8 h-8 text-xs',
  md:  'w-10 h-10 text-sm',
  lg:  'w-12 h-12 text-base',
  xl:  'w-16 h-16 text-lg',
  '2xl':'w-20 h-20 text-xl',
};

const statusColorMap = {
  online:  'bg-success',
  offline: 'bg-dark-300',
  away:    'bg-warning',
  busy:    'bg-danger',
};

const statusSizeMap = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-3.5 h-3.5',
  '2xl': 'w-4 h-4',
};

/** Extract up to 2 initials from a display name */
function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic background color from name string */
const COLORS = [
  'bg-primary-800', 'bg-secondary-500', 'bg-success',
  'bg-info', 'bg-warning', 'bg-dark-600',
];
function getBgColor(name = '') {
  let hash = 0;
  for (const char of name) hash += char.charCodeAt(0);
  return COLORS[hash % COLORS.length];
}

function Avatar({ src, name = '', size = 'md', shape = 'circle', status, className }) {
  const roundedClass = shape === 'square' ? 'rounded-lg' : 'rounded-full';

  return (
    <span className={clsx('relative inline-flex shrink-0', className)}>
      {src ? (
        <img
          src={src}
          alt={name || 'Avatar'}
          className={clsx('object-cover', sizeMap[size], roundedClass)}
        />
      ) : (
        <span
          className={clsx(
            'inline-flex items-center justify-center font-semibold text-white select-none',
            sizeMap[size],
            roundedClass,
            getBgColor(name)
          )}
          aria-label={name}
        >
          {getInitials(name)}
        </span>
      )}

      {status && (
        <span
          className={clsx(
            'absolute bottom-0 right-0 rounded-full ring-2 ring-white',
            statusColorMap[status],
            statusSizeMap[size]
          )}
        />
      )}
    </span>
  );
}

export default Avatar;
