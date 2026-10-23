import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, ShieldAlert } from 'lucide-react';
import { useAuth, HOME_BY_ROLE } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Spinner } from '../components/ui';

/** Login page with validation, show/hide password and role-based redirect. */
export default function Login() {
  const { login, sessionMessage, clearSessionMessage } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
    if (sessionMessage) clearSessionMessage();
  };

  const validate = () => {
    const next = {};
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Please enter a valid email address.';
    if (!form.password) next.password = 'Password is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return; // prevent duplicate submissions
    setFormError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      const user = await login({ email: form.email.trim(), password: form.password });
      toast.success(`Welcome back, ${user.name}!`);

      // Honour ?from= when it points at a safe in-app path, otherwise use the
      // dashboard that matches the user's role.
      const from = new URLSearchParams(location.search).get('from');
      const target = from && from.startsWith('/') && !from.startsWith('//')
        ? from
        : HOME_BY_ROLE[user.role] || '/';
      navigate(target, { replace: true });
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="shell py-14">
      <div className="max-w-md mx-auto">
        <div className="card p-6 md:p-8">
          <div className="text-center">
            <span className="stat-icon mx-auto mb-3" style={{ background: '#fff0e6', color: '#c2410c' }}>
              <LogIn size={22} />
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 m-0">Welcome back</h1>
            <p className="text-sm text-slate-500 mt-1 mb-0">Sign in to your FoodShare Community account</p>
          </div>

          {sessionMessage ? (
            <div className="alert alert-warning mt-5 flex items-center gap-2" role="alert">
              <ShieldAlert size={17} className="shrink-0" />
              <p className="m-0">{sessionMessage}</p>
            </div>
          ) : null}
          {formError ? (
            <div className="alert alert-danger mt-5" role="alert">{formError}</div>
          ) : null}

          <form onSubmit={submit} noValidate className="mt-5 space-y-4">
            <div>
              <label className="field-label" htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                className={`input ${errors.email ? 'input-error' : ''}`}
                placeholder="you@example.com"
                value={form.email}
                onChange={update}
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email ? <p className="field-error">{errors.email}</p> : null}
            </div>

            <div>
              <label className="field-label" htmlFor="password">Password</label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  className={`input pr-11 ${errors.password ? 'input-error' : ''}`}
                  placeholder="Your password"
                  value={form.password}
                  onChange={update}
                  autoComplete="current-password"
                  aria-invalid={Boolean(errors.password)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1.5"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {errors.password ? <p className="field-error">{errors.password}</p> : null}
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? <><Spinner small label="" /> Signing in…</> : 'Sign in'}
            </button>
          </form>

          <p className="text-sm text-center text-slate-500 mt-5 mb-0">
            New here?{' '}
            <Link to="/register" className="link no-underline">Create an account</Link>
          </p>
        </div>

        <p className="text-xs text-center text-slate-400 mt-4">
          Administrator accounts are created by the project administrator script — there is no public
          admin registration.
        </p>
      </div>
    </div>
  );
}