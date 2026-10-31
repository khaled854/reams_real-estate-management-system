import clsx from 'clsx';
import branding from '../../config/branding';

/**
 * CompanyLogo
 * ─────────────────────────────────────────────────────────────
 * Renders the سوق العقارات logo image consistently across the app.
 *
 * Props:
 *   variant  — 'color' (default) | 'white'
 *              'color' → uses branding.logoPath (for light backgrounds)
 *              'white' → uses branding.logoWhitePath or applies CSS invert
 *                        (for dark backgrounds like the sidebar)
 *
 *   size     — 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full'
 *              Controls max-height; 'full' fills its container.
 *
 *   showName — boolean — whether to show companyName text next to logo
 *   className— additional classes
 */

const SIZE_MAP = {
  xs:   'h-6',
  sm:   'h-8',
  md:   'h-10',
  lg:   'h-14',
  xl:   'h-20',
  full: 'h-full w-full object-contain',
};

function CompanyLogo({
  variant   = 'color',
  size      = 'md',
  showName  = false,
  className,
  imgClassName,
}) {
  const isWhite  = variant === 'white';
  const src      = isWhite && !branding.invertLogoOnDark
    ? branding.logoWhitePath
    : branding.logoPath;

  const filterStyle = isWhite && branding.invertLogoOnDark
    ? { filter: 'brightness(0) invert(1)' }
    : undefined;

  return (
    <div className={clsx('flex items-center gap-2 shrink-0', className)}>
      <img
        src={src}
        alt={branding.companyName}
        style={filterStyle}
        className={clsx(
          SIZE_MAP[size] ?? SIZE_MAP.md,
          size !== 'full' && 'w-auto object-contain',
          imgClassName
        )}
        draggable={false}
      />
      {showName && (
        <span
          className={clsx(
            'font-bold font-arabic leading-none',
            isWhite ? 'text-white' : 'text-dark-800',
            size === 'xs' || size === 'sm' ? 'text-sm' : 'text-base'
          )}
        >
          {branding.companyName}
        </span>
      )}
    </div>
  );
}

export default CompanyLogo;
