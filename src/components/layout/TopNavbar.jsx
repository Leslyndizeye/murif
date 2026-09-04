import { useAuth } from '../../contexts/AuthContext';

/**
 * Shared top bar used on every page: logo, dark mode toggle, user avatar.
 * Pages that need extra controls (e.g. notifications) can pass them via `rightExtra`,
 * so the shared base stays identical everywhere while pages can still add their own bits.
 */
const TopNavbar = ({ title, rightExtra }) => {
  const { user } = useAuth();

  const getInitials = () => {
    if (!user) return 'U';
    if (user.full_name) {
      const names = user.full_name.split(' ');
      return names.length >= 2
        ? `${names[0][0]}${names[1][0]}`.toUpperCase()
        : names[0][0].toUpperCase();
    }
    if (user.username) return user.username.charAt(0).toUpperCase();
    if (user.email) return user.email.charAt(0).toUpperCase();
    return 'U';
  };

  return (
    <header className="muri-topnav">
      <div className="muri-topnav-left">
        <img
          src="/Logo.png"
          alt="MURI Logo"
          className="muri-topnav-logo"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        {title && <span className="muri-topnav-title">{title}</span>}
      </div>

      <div className="muri-topnav-right">
        {rightExtra}
        <div className="muri-topnav-user">
          <div className="muri-topnav-avatar">{getInitials()}</div>
          {user && (
            <div className="muri-topnav-user-info">
              <span className="muri-topnav-user-name">
                {user.full_name || user.username || user.email}
              </span>
              {(user.department || user.role) && (
                <span className="muri-topnav-user-role">
                  {user.department && `${user.department} • `}{user.role || ''}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopNavbar;
