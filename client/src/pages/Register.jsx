import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { Eye, EyeOff, UserPlus, HandHeart, Building2, Bike, Info } from 'lucide-react';
import { useAuth, HOME_BY_ROLE } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { statsAPI, getApiErrorMessage } from '../services/api';
import { Spinner } from '../components/ui';
import { ROLE_LABELS } from '../utils/format';
import { FALLBACK_DONOR_CATEGORIES, FALLBACK_FOOD_CATEGORIES, mergeMeta } from '../utils/metaFallbacks';

const ROLE_OPTIONS = [
  { value: 'DONOR', label: 'Food Donor', icon: HandHeart, text: 'I have surplus food to give' },
  { value: 'NGO', label: 'NGO', icon: Building2, text: 'We collect and distribute food' },
  { value: 'VOLUNTEER', label: 'Volunteer', icon: Bike, text: 'I can pick up and deliver food' },
];

/**
 * Registration page. The ADMIN role is deliberately absent from the form AND
 * rejected by the backend - admin accounts come from scripts/createAdmin.js.
 */
export default function Register() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { register, user, loading } = useAuth();
  const toast = useToast();

  const initialRole = ['DONOR', 'NGO', 'VOLUNTEER'].includes(params.get('role')) ? params.get('role') : 'DONOR';

  const [meta, setMeta] = useState({ donorCategories: FALLBACK_DONOR_CATEGORIES, foodCategories: FALLBACK_FOOD_CATEGORIES });
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    role: initialRole,
    address: '',
    city: '',
    organizationName: '',
    organizationDescription: '',
    donorCategory: 'Household',
    terms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    statsAPI
      .meta()
      .then((res) => {
        if (!mounted) return;
        // Merge over the fallbacks so a partial response can't blank the form.
        setMeta((prev) => mergeMeta(prev, res.data));
      })
      .catch(() => {
        /* keep the static fallbacks */
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Already signed in? Go straight to the dashboard.
  if (!loading && user) return <Navigate to={HOME_BY_ROLE[user.role] || '/'} replace />;

  const update = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim() || form.name.trim().length < 2) next.name = 'Please enter your full name (min 2 characters).';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Please enter a valid email address.';
    if (form.password.length < 6) next.password = 'Password must be at least 6 characters.';
    else if (!/[A-Za-z]/.test(form.password)) next.password = 'Password must contain at least one letter.';
    if (form.password !== form.confirmPassword) next.confirmPassword = 'Passwords do not match.';
    if (!/^[0-9+\-\s()]{7,15}$/.test(form.phone)) next.phone = 'Please enter a valid phone number (7–15 digits).';
    if (!form.city.trim()) next.city = 'City is required.';
    if (form.role === 'NGO' && !form.organizationName.trim())
      next.organizationName = 'Organization name is required for NGO accounts.';
    if (!form.terms) next.terms = 'You must accept the terms and conditions.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return; // block duplicate submissions
    setFormError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim(),
        role: form.role,
        address: form.address.trim(),
        city: form.city.trim(),
        terms: form.terms,
      };
      if (form.role === 'NGO') {
        payload.organizationName = form.organizationName.trim();
        payload.organizationDescription = form.organizationDescription.trim();
      }
      if (form.role === 'DONOR') payload.donorCategory = form.donorCategory;

      const createdUser = await register(payload);
      toast.success(
        createdUser.role === 'NGO'
          ? 'NGO account created — pending administrator verification.'
          : 'Account created successfully!'
      );
      navigate(HOME_BY_ROLE[createdUser.role] || '/', { replace: true });
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'Registration failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedRole = ROLE_OPTIONS.find((r) => r.value === form.role) || ROLE_OPTIONS[0];

  return (
    <div className="shell py-12">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <span className="eyebrow">Create account</span>
          <h1 className="text-3xl font-extrabold text-slate-900 mt-2">Join FoodShare Community</h1>
          <p className="muted mt-2">
            Choose how you want to participate. You can only change role later by contacting an administrator.
          </p>
        </div>

        <div className="card p-6 md:p-8">
          {formError ? <div className="alert alert-danger mb-5" role="alert">{formError}</div> : null}

          <form onSubmit={submit} noValidate>
            {/* Role picker */}
            <fieldset className="border-0 p-0 m-0">
              <legend className="field-label">I am registering as a</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {ROLE_OPTIONS.map((r) => (
                  <label
                    key={r.value}
                    className={`card card-hover p-4 cursor-pointer flex flex-col items-center text-center gap-1.5 ${
                      form.role === r.value ? 'border-primary ring-2 ring-primary/25' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r.value}
                      checked={form.role === r.value}
                      onChange={update}
                      className="sr-only"
                    />
                    <r.icon size={22} className={form.role === r.value ? 'text-primary-dark' : 'text-slate-400'} />
                    <span className="text-sm font-bold text-slate-800">{r.label}</span>
                    <span className="text-xs text-slate-500">{r.text}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="form-row form-row-2 mt-6">
              <div>
                <label className="field-label" htmlFor="name">{form.role === 'NGO' ? 'Coordinator name' : 'Full name'}</label>
                <input id="name" name="name" className={`input ${errors.name ? 'input-error' : ''}`} value={form.name} onChange={update} placeholder="Your name" />
                {errors.name ? <p className="field-error">{errors.name}</p> : null}
              </div>
              <div>
                <label className="field-label" htmlFor="regEmail">Email address</label>
                <input id="regEmail" name="email" type="email" className={`input ${errors.email ? 'input-error' : ''}`} value={form.email} onChange={update} placeholder="you@example.com" />
                {errors.email ? <p className="field-error">{errors.email}</p> : null}
              </div>
            </div>

            <div className="form-row form-row-2 mt-4">
              <div>
                <label className="field-label" htmlFor="password">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    className={`input pr-11 ${errors.password ? 'input-error' : ''}`}
                    value={form.password}
                    onChange={update}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
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
              <div>
                <label className="field-label" htmlFor="confirmPassword">Confirm password</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  className={`input ${errors.confirmPassword ? 'input-error' : ''}`}
                  value={form.confirmPassword}
                  onChange={update}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                />
                {errors.confirmPassword ? <p className="field-error">{errors.confirmPassword}</p> : null}
              </div>
            </div>

            <div className="form-row form-row-2 mt-4">
              <div>
                <label className="field-label" htmlFor="phone">Phone number</label>
                <input id="phone" name="phone" className={`input ${errors.phone ? 'input-error' : ''}`} value={form.phone} onChange={update} placeholder="e.g. 98765 43210" />
                {errors.phone ? <p className="field-error">{errors.phone}</p> : null}
              </div>
              <div>
                <label className="field-label" htmlFor="city">City</label>
                <input id="city" name="city" className={`input ${errors.city ? 'input-error' : ''}`} value={form.city} onChange={update} placeholder="e.g. Pune" />
                {errors.city ? <p className="field-error">{errors.city}</p> : null}
              </div>
            </div>

            <div className="mt-4">
              <label className="field-label" htmlFor="address">Address (street, area)</label>
              <input id="address" name="address" className="input" value={form.address} onChange={update} placeholder="House / office address" />
            </div>

            {form.role === 'DONOR' ? (
              <div className="mt-4">
                <label className="field-label" htmlFor="donorCategory">Donor category</label>
                <select id="donorCategory" name="donorCategory" className="select" value={form.donorCategory} onChange={update}>
                  {meta.donorCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            ) : null}

            {form.role === 'NGO' ? (
              <>
                <div className="form-row form-row-2 mt-4">
                  <div>
                    <label className="field-label" htmlFor="organizationName">Organization name</label>
                    <input id="organizationName" name="organizationName" className={`input ${errors.organizationName ? 'input-error' : ''}`} value={form.organizationName} onChange={update} placeholder="e.g. Hope Foundation" />
                    {errors.organizationName ? <p className="field-error">{errors.organizationName}</p> : null}
                  </div>
                  <div className="hidden sm:block" />
                </div>
                <div className="mt-4">
                  <label className="field-label" htmlFor="organizationDescription">Organization description (optional)</label>
                  <textarea id="organizationDescription" name="organizationDescription" className="textarea" value={form.organizationDescription} onChange={update} placeholder="What does your organisation do?" />
                </div>
                <div className="alert alert-info mt-4 flex gap-2">
                  <Info size={16} className="shrink-0 mt-0.5" />
                  <p className="m-0 text-sm">NGO accounts are created with <strong>PENDING</strong> status and are verified by an administrator.</p>
                </div>
              </>
            ) : null}

            <label className="flex items-start gap-2.5 mt-6 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" name="terms" checked={form.terms} onChange={update} className="mt-1" />
              <span>
                I accept the{' '}
                <Link to="/how-it-works" className="link no-underline">terms and conditions</Link>{' '}
                — including the requirement that only food suitable for safe consumption is listed.
                {errors.terms ? <span className="field-error block">{errors.terms}</span> : null}
              </span>
            </label>

            <button type="submit" className="btn btn-primary btn-block mt-6" disabled={submitting}>
              {submitting ? <><Spinner small label="" /> Creating account…</> : <><UserPlus size={17} /> Create account as {ROLE_LABELS[form.role]}</>}
            </button>
          </form>

          <p className="text-sm text-center text-slate-500 mt-5 mb-0">
            Already registered? <Link to="/login" className="link no-underline">Sign in</Link>
          </p>
        </div>

        <p className="text-xs text-center text-slate-400 mt-4">
          Administrator accounts are not part of the registration form. They are created securely with the
          documented <code>npm run create-admin</code> script.
        </p>
      </div>
    </div>
  );
}