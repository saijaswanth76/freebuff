import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Bell, Leaf, LogOut, CheckCheck, X, Menu } from 'lucide-react';
import { useAuth, HOME_BY_ROLE } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { notificationsAPI, getApiErrorMessage } from '../services/api';
import { formatDateTime, ROLE_LABELS } from '../utils/format';

/**
 * Dashboard shell shared by all four roles: sidebar navigation, header with
 * notifications and logout, plus role-specific verification notices.
 */
export default function DashboardLayout({ title, subtitle, links = [], banner = null }) {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const panelRef = useRef(null);

  const loadNotifications = async () => {
    setNotifLoading(true);
    try {
      const res = await notificationsAPI.list({ limit: 8 });
      setNotifications(res.data.notifications);
      setUnread(res.data.unreadCount);
    } catch (error) {
      console.warn('notifications failed', getApiErrorMessage(error));
    } finally {
      setNotifLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    // Refresh the unread counter occasionally while the dashboard is open.
    const id = setInterval(loadNotifications, 60000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleLogout = async () => {
    await logout();
    toast.success('You have been logged out.');
    navigate('/');
  };

  const markAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      await loadNotifications();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const verificationBanner =
    banner ||
    (user?.role === 'NGO' && user.verificationStatus === 'PENDING'
      ? { type: 'alert-info', text: 'Your NGO registration is awaiting administrator verification. You can browse and accept donations in the meantime.' }
      : user?.role === 'NGO' && user.verificationStatus === 'REJECTED'
        ? { type: 'alert-danger', text: 'Your NGO registration was rejected. Please contact the administrator for details.' }
        : null);

  const sidebarLinks = (
    <>
      {links.map((l) => {
        const Icon = l.icon;
        return (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}
            onClick={() => setMenuOpen(false)}
          >
            {Icon ? <Icon size={17} /> : null}
            {l.label}
          </NavLink>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-line">
        <div className="shell h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="lg:hidden btn btn-sm btn-outline"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle dashboard menu"
            >
              <Menu size={17} />
            </button>
            <Link to={HOME_BY_ROLE[user?.role] || '/'} className="flex items-center gap-2 no-underline">
              <span className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center">
                <Leaf size={19} />
              </span>
              <span className="hidden sm:block leading-tight">
                <span className="block text-[15px] font-extrabold text-slate-900">FoodShare Community</span>
                <span className="block text-[11px] text-slate-500 -mt-0.5">{ROLE_LABELS[user?.role]} dashboard</span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative" ref={panelRef}>
              <button
                type="button"
                className="btn btn-sm btn-outline relative"
                onClick={() => {
                  setNotifOpen((v) => !v);
                  if (!notifOpen) loadNotifications();
                }}
                aria-label="Notifications"
              >
                <Bell size={16} />
                {unread > 0 ? (
                  <span className="absolute -top-1.5 -right-1.5 bg-danger text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {unread > 9 ? '9+' : unread}
                  </span>
                ) : null}
              </button>

              {notifOpen ? (
                <div className="absolute right-0 mt-2 w-80 card p-0 z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                    <p className="text-sm font-bold m-0">Notifications</p>
                    <button type="button" className="btn btn-xs btn-ghost" onClick={markAllRead} title="Mark all as read">
                      <CheckCheck size={15} />
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifLoading ? (
                      <p className="text-sm text-slate-500 p-4 m-0">Loading…</p>
                    ) : notifications.length === 0 ? (
                      <p className="text-sm text-slate-500 p-4 m-0">No notifications yet.</p>
                    ) : (
                      notifications.map((n) => (
                        <div key={n._id} className={`px-4 py-3 border-b border-line last:border-0 ${n.isRead ? 'opacity-70' : ''}`}>
                          <p className="text-sm font-semibold text-slate-800 m-0">{n.title}</p>
                          <p className="text-xs text-slate-600 m-0 mt-0.5">{n.message}</p>
                          <p className="text-[11px] text-slate-400 m-0 mt-1">{formatDateTime(n.createdAt)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="hidden sm:block text-right leading-tight">
              <p className="text-sm font-bold text-slate-800 m-0">{user?.name}</p>
              <p className="text-[11px] text-slate-500 m-0">{user?.organizationName || user?.city}</p>
            </div>

            <button type="button" className="btn btn-sm btn-outline" onClick={handleLogout} title="Log out">
              <LogOut size={16} /> <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile sidebar */}
        {menuOpen ? (
          <div className="lg:hidden border-t border-line bg-white px-4 py-3 flex flex-col gap-1">{sidebarLinks}</div>
        ) : null}
      </header>

      <div className="shell py-7">
        <div className="mb-5">
          <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
          {subtitle ? <p className="text-sm text-slate-500 mt-1">{subtitle}</p> : null}
        </div>

        {verificationBanner ? (
          <div className={`alert ${verificationBanner.type} mb-5 flex items-start gap-2`} role="status">
            <X size={16} className="hidden" />
            <p className="m-0">{verificationBanner.text}</p>
          </div>
        ) : null}

        <div className="dash">
          <aside className="hidden lg:flex flex-col gap-1 sidebar">{sidebarLinks}</aside>
          <div className="min-w-0">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
