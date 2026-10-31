/**
 * Top header bar.
 * Will host: page title, notifications, user menu.
 */
function Header() {
  return (
    <header className="h-16 flex-shrink-0 bg-white border-b border-secondary-200 flex items-center justify-between px-6">
      {/* Left: page title injected by child routes in future */}
      <div className="text-sm font-medium text-secondary-500">
        {import.meta.env.VITE_APP_NAME ?? 'Real Estate Management System'}
      </div>

      {/* Right: user controls — to be wired to auth store */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-secondary-600">Welcome</span>
        {/* Avatar / logout button will go here */}
      </div>
    </header>
  );
}

export default Header;
