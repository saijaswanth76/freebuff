import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, LayoutDashboard, LogOut, Leaf } from 'lucide-react';
import { useAuth, HOME_BY_ROLE } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ROLE_LABELS } from '../utils/format';

const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About Us' },
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/donations', label: 'Available Donations' },
];

/** Public navigation bar shown on all non-dashboard pages. */
export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('You have been logged out.');
    navigate('/');
  };

  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-semibold no-underline transition ${
      isActive ? 'text-primary-dark bg-primary-soft' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }`;

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-line">
      <div className="shell h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 no-underline" onClick={() => setOpen(false)}>
          <span className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center">
            <Leaf size={19} />
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-extrabold text-slate-900">FoodShare Community</span>
            <span className="block text-[11px] text-slate-500 -mt-0.5">Donation &amp; Distribution System</span>
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass} end={l.to === '/'}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-2">
          {user ? (
            <>
              <span className="text-xs text-slate-500 mr-1">
                {user.name} · <span className="font-semibold text-slate-700">{ROLE_LABELS[user.role]}</span>
              </span>
              <Link to={HOME_BY_ROLE[user.role]} className="btn btn-sm btn-outline-primary no-underline">
                <LayoutDashboard size={15} /> Dashboard
              </Link>
              <button type="button" className="btn btn-sm btn-outline" onClick={handleLogout}>
                <LogOut size={15} /> Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-sm btn-outline no-underline">
                Login
              </Link>
              <Link to="/register" className="btn btn-sm btn-primary no-underline">
                Register
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="lg:hidden btn btn-sm btn-outline"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle navigation menu"
          aria-expanded={open}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open ? (
        <div className="lg:hidden border-t border-line bg-white px-4 py-3 space-y-1">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={`${linkClass} block`} end={l.to === '/'} onClick={() => setOpen(false)}>
              {l.label}
            </NavLink>
          ))}
          <hr className="divider" />
          {user ? (
            <div className="flex gap-2">
              <Link to={HOME_BY_ROLE[user.role]} className="btn btn-sm btn-primary no-underline flex-1" onClick={() => setOpen(false)}>
                Dashboard
              </Link>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => {
                  setOpen(false);
                  handleLogout();
                }}
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link to="/login" className="btn btn-sm btn-outline no-underline flex-1" onClick={() => setOpen(false)}>
                Login
              </Link>
              <Link to="/register" className="btn btn-sm btn-primary no-underline flex-1" onClick={() => setOpen(false)}>
                Register
              </Link>
            </div>
          )}
        </div>
      ) : null}
    </header>
  );
}
