import clsx from 'clsx';

/**
 * Divider
 * orientation: horizontal (default) | vertical
 * label:       optional centered text label
 */
function Divider({ orientation = 'horizontal', label, className }) {
  if (orientation === 'vertical') {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={clsx('divider-vertical', className)}
      />
    );
  }

  if (label) {
    return (
      <div className={clsx('flex items-center gap-3 my-4', className)} role="separator">
        <span className="flex-1 border-t border-dark-100" />
        <span className="text-xs font-medium text-dark-400 whitespace-nowrap">{label}</span>
        <span className="flex-1 border-t border-dark-100" />
      </div>
    );
  }

  return (
    <hr
      role="separator"
      className={clsx('divider', className)}
    />
  );
}

export default Divider;
