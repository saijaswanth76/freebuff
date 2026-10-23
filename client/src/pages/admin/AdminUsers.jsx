import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, Search, BadgeCheck, ShieldOff, UserCheck, UserX, CheckCircle2, XCircle } from 'lucide-react';
import Pagination from '../../components/Pagination';
import { LoadingBlock, EmptyState, ErrorNotice, Spinner } from '../../components/ui';
import { adminAPI, getApiErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { formatDate, ROLE_LABELS } from '../../utils/format';

const ROLE_FILTERS = [
  ['', 'All roles'],
  ['DONOR', 'Donors'],
  ['NGO', 'NGOs'],
  ['VOLUNTEER', 'Volunteers'],
  ['ADMIN', 'Admins'],
];

/** Admin: list, filter, verify NGOs and activate/deactivate accounts. */
export default function AdminUsers() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 15 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchDraft, setSearchDraft] = useState('');
  const [filters, setFilters] = useState({
    role: '',
    verificationStatus: params.get('filter') || '',
    search: '',
    page: 1,
  });

  // Confirmation dialogs: { type: 'status' | 'verify', user, value? }
  const [action, setAction] = useState(null);
  const [verifyNote, setVerifyNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setFilters((f) => ({ ...f, search: searchDraft, page: 1 })), 400);
    return () => clearTimeout(id);
  }, [searchDraft]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = { page: filters.page, limit: 15 };
      if (filters.role) query.role = filters.role;
      if (filters.verificationStatus) query.verificationStatus = filters.verificationStatus;
      if (filters.search) query.search = filters.search;
      const res = await adminAPI.users(query);
      setUsers(res.data.users);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load users.'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (patch) => setFilters((f) => ({ ...f, ...patch, page: 'page' in patch ? patch.page : 1 }));

  const runAction = async () => {
    if (!action || busy) return;
    setBusy(true);
    try {
      if (action.type === 'status') {
        const isActive = action.value;
        await adminAPI.setUserStatus(action.user._id, isActive);
        toast.success(`${action.user.name} ${isActive ? 'activated' : 'deactivated'}.`);
      } else {
        await adminAPI.verifyNgo(action.user._id, { verificationStatus: action.value, note: verifyNote });
        toast.success(
          `${action.user.organizationName || action.user.name} ${action.value === 'VERIFIED' ? 'verified' : 'rejected'}.`
        );
      }
      setAction(null);
      setVerifyNote('');
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'The operation failed.'));
      setAction(null);
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 m-0">User Management</h2>
        <p className="text-sm text-slate-500 m-0">
          Verify NGO registrations and activate or deactivate user accounts across the platform.
        </p>
      </div>

      {/* Filters */}
      <div className="card p-4 md:p-5 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search by name, email, organisation or city…"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            aria-label="Search users"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {ROLE_FILTERS.map(([value, label]) => (
            <button
              key={value || 'all'}
              type="button"
              className={`btn btn-sm ${filters.role === value ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => update({ role: value })}
            >
              {label}
            </button>
          ))}
          <span className="w-px bg-line mx-1" />
          {[
            ['', 'Any verification'],
            ['PENDING', 'Pending'],
            ['VERIFIED', 'Verified'],
            ['REJECTED', 'Rejected'],
          ].map(([value, label]) => (
            <button
              key={value || 'any'}
              type="button"
              className={`btn btn-sm ${filters.verificationStatus === value ? 'btn-accent' : 'btn-outline'}`}
              onClick={() => {
                update({ verificationStatus: value });
                const next = new URLSearchParams(params);
                if (value) next.set('filter', value);
                else next.delete('filter');
                setParams(next, { replace: true });
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingBlock label="Loading users…" />
      ) : error ? (
        <ErrorNotice message={error} onRetry={load} />
      ) : users.length === 0 ? (
        <EmptyState icon={<Users size={28} />} title="No users match these filters" description="Try clearing the search or role filter." />
      ) : (
        <div className="table-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>City</th>
                <th>Joined</th>
                <th>Verification</th>
                <th>Account</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td>
                    <p className="font-semibold text-slate-800 m-0">{u.name}</p>
                    <p className="text-xs text-slate-500 m-0">{u.email}</p>
                    {u.organizationName ? <p className="text-xs text-slate-400 m-0">{u.organizationName}</p> : null}
                  </td>
                  <td className="text-sm">{ROLE_LABELS[u.role]}</td>
                  <td className="text-sm">{u.city}</td>
                  <td className="text-sm text-slate-500">{formatDate(u.createdAt)}</td>
                  <td>
                    <span
                      className={`badge ${
                        u.verificationStatus === 'VERIFIED'
                          ? 'badge-success'
                          : u.verificationStatus === 'REJECTED'
                            ? 'badge-danger'
                            : u.verificationStatus === 'PENDING'
                              ? 'badge-warning'
                              : 'badge-neutral'
                      }`}
                    >
                      {u.verificationStatus}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.isActive ? 'badge-success' : 'badge-cancelled'}`}>
                      {u.isActive ? 'ACTIVE' : 'DEACTIVATED'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      {u.role === 'NGO' && u.verificationStatus === 'PENDING' ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                              setVerifyNote('');
                              setAction({ type: 'verify', user: u, value: 'VERIFIED' });
                            }}
                            title="Verify NGO"
                          >
                            <CheckCircle2 size={14} /> Verify
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => {
                              setVerifyNote('');
                              setAction({ type: 'verify', user: u, value: 'REJECTED' });
                            }}
                            title="Reject registration"
                          >
                            <XCircle size={14} />
                          </button>
                        </>
                      ) : null}
                      {u.role !== 'ADMIN' ? (
                        <button
                          type="button"
                          className={`btn btn-sm ${u.isActive ? 'btn-outline' : 'btn-primary'}`}
                          onClick={() => setAction({ type: 'status', user: u, value: !u.isActive })}
                          title={u.isActive ? 'Deactivate account' : 'Reactivate account'}
                        >
                          {u.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      ) : (
                        <span className="badge badge-neutral">Admin</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination pagination={pagination} onChange={(page) => update({ page })} />

      {/* Verify / deactivate confirmation */}
      <div className="modal-backdrop" role="dialog" aria-modal="true" style={{ display: action ? 'flex' : 'none' }}>
        <div className="modal-card">
          {action?.type === 'verify' ? (
            <>
              <h3 className="text-lg font-bold text-slate-900 m-0">
                {action.value === 'VERIFIED' ? 'Verify NGO registration?' : 'Reject NGO registration?'}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {action.user.organizationName || action.user.name} ({action.user.email}) — the coordinator will be
                notified of the result.
              </p>
              <div className="mt-4">
                <label className="field-label" htmlFor="verifyNote">Note to the NGO (optional)</label>
                <textarea
                  id="verifyNote"
                  className="textarea"
                  placeholder="e.g. Registration documents verified"
                  value={verifyNote}
                  onChange={(e) => setVerifyNote(e.target.value)}
                />
              </div>
            </>
          ) : action?.type === 'status' ? (
            <>
              <h3 className="text-lg font-bold text-slate-900 m-0">
                {action.value ? 'Reactivate this account?' : 'Deactivate this account?'}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {action.user.name} ({action.user.email}){' '}
                {action.value
                  ? 'will be able to log in again.'
                  : 'will be blocked from logging in immediately; existing data is kept.'}
              </p>
            </>
          ) : null}

          <div className="flex justify-end gap-2 mt-5">
            <button type="button" className="btn btn-outline" onClick={() => setAction(null)} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className={`btn ${action?.type === 'status' && !action.value ? 'btn-danger' : 'btn-primary'}`}
              onClick={runAction}
              disabled={busy}
            >
              {busy ? 'Applying…' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>

      {busy ? <Spinner small label="" /> : null}
    </div>
  );
}