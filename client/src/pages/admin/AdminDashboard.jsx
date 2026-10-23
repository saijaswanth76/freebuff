import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  HandHeart,
  Handshake,
  Bike,
  ShieldCheck,
  Clock,
  PackageCheck,
  XCircle,
  BadgeCheck,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { LoadingBlock, ErrorNotice } from '../../components/ui';
import { adminAPI, getApiErrorMessage } from '../../services/api';
import { ROLE_LABELS, formatDateTime } from '../../utils/format';

const STATUS_COLORS = {
  AVAILABLE: '#ea580c',
  ACCEPTED: '#0D6EFD',
  PICKUP_ASSIGNED: '#F59F00',
  COLLECTED: '#0958D9',
  DISTRIBUTED: '#7048E8',
  COMPLETED: '#0F5132',
  CANCELLED: '#DC3545',
  REJECTED: '#6C757D',
};

const CHART_TOOLTIP = {
  contentStyle: { borderRadius: 10, border: '1px solid #e6ebf1', fontSize: 13 },
};

/** Admin dashboard: platform KPIs, charts and recent activity (all from MongoDB). */
export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminAPI.dashboard();
      setData(res.data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load the admin dashboard.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingBlock label="Loading platform statistics…" />;
  if (error) return <ErrorNotice message={error} onRetry={load} />;

  const s = data.stats;
  const charts = data.charts;

  const pieData = charts.donationsByStatus
    .filter((row) => row.count > 0)
    .map((row) => ({ name: row.status, value: row.count, fill: STATUS_COLORS[row.status] || '#94A3B8' }));
  const monthData = charts.donationsByMonth.map((row) => ({ month: row.month, Donations: row.value }));
  const userMonthData = charts.usersByMonth.map((row) => ({ month: row.month, Users: row.value }));

  return (
    <div className="space-y-6">
      {/* Platform KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Total users" value={s.totalUsers} tone="blue" />
        <StatCard icon={HandHeart} label="Total donors" value={s.donors} tone="green" />
        <StatCard icon={Handshake} label="NGOs" value={s.ngos} tone="amber" />
        <StatCard icon={Bike} label="Volunteers" value={s.volunteers} tone="slate" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={HandHeart} label="Total donations" value={s.totalDonations} tone="green" />
        <StatCard icon={Clock} label="Pending donations" value={s.pendingDonations} tone="amber" hint="Available / accepted / in pickup" />
        <StatCard icon={PackageCheck} label="Completed donations" value={s.completedDonations} tone="blue" />
        <StatCard icon={XCircle} label="Cancelled donations" value={s.cancelledDonations} tone="red" />
      </div>

      {s.pendingNgoVerifications > 0 ? (
        <div className="alert alert-warning flex items-center justify-between gap-3" role="status">
          <p className="m-0">
            <strong>{s.pendingNgoVerifications}</strong> NGO registration{s.pendingNgoVerifications === 1 ? '' : 's'} waiting for verification.
          </p>
          <Link to="/admin/users?filter=PENDING" className="btn btn-sm btn-outline no-underline">
            <BadgeCheck size={15} /> Review now
          </Link>
        </div>
      ) : null}

      {/* Charts row 1 */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-lg font-bold text-slate-900 m-0 mb-4">Donations by status</h2>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip {...CHART_TOOLTIP} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-lg font-bold text-slate-900 m-0 mb-4">Donations by category</h2>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.donationsByCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
                <XAxis dataKey="category" fontSize={11} tick={{ fill: '#6C757D' }} interval={0} angle={-18} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} fontSize={11} tick={{ fill: '#6C757D' }} />
                <Tooltip {...CHART_TOOLTIP} />
                <Bar dataKey="count" name="Donations" fill="#ea580c" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-lg font-bold text-slate-900 m-0 mb-4">New donations per month (last 6 months)</h2>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
                <XAxis dataKey="month" fontSize={11} tick={{ fill: '#6C757D' }} />
                <YAxis allowDecimals={false} fontSize={11} tick={{ fill: '#6C757D' }} />
                <Tooltip {...CHART_TOOLTIP} />
                <Line type="monotone" dataKey="Donations" stroke="#0D6EFD" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-lg font-bold text-slate-900 m-0 mb-4">User registrations per month</h2>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={userMonthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
                <XAxis dataKey="month" fontSize={11} tick={{ fill: '#6C757D' }} />
                <YAxis allowDecimals={false} fontSize={11} tick={{ fill: '#6C757D' }} />
                <Tooltip {...CHART_TOOLTIP} />
                <Bar dataKey="Users" fill="#0D6EFD" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-slate-900 m-0">Recent donations</h2>
            <Link to="/admin/donations" className="link no-underline text-sm">Manage donations</Link>
          </div>
          <div className="table-shell mt-4">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Food</th>
                  <th>Donor</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.recentDonations.length === 0 ? (
                  <tr><td colSpan={4} className="text-center text-slate-500">No donations yet.</td></tr>
                ) : (
                  data.recentDonations.map((d) => (
                    <tr key={d._id}>
                      <td className="font-semibold text-slate-800">
                        <Link to={`/donations/${d._id}`} className="link no-underline">{d.foodName}</Link>
                      </td>
                      <td className="text-sm">{d.donorId?.name || '—'}<span className="text-slate-400"> · {d.donorId?.city || ''}</span></td>
                      <td><StatusBadge status={d.status} /></td>
                      <td className="text-sm text-slate-500">{formatDateTime(d.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-slate-900 m-0">Recent users</h2>
            <Link to="/admin/users" className="link no-underline text-sm">Manage users</Link>
          </div>
          <div className="table-shell mt-4">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>City</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentUsers.length === 0 ? (
                  <tr><td colSpan={4} className="text-center text-slate-500">No users yet.</td></tr>
                ) : (
                  data.recentUsers.map((u) => (
                    <tr key={u._id}>
                      <td className="font-semibold text-slate-800">{u.name}</td>
                      <td className="text-sm">{ROLE_LABELS[u.role]}</td>
                      <td className="text-sm">{u.city}</td>
                      <td>
                        {u.role === 'NGO' ? (
                          <span className={`badge ${u.verificationStatus === 'VERIFIED' ? 'badge-success' : u.verificationStatus === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                            {u.verificationStatus}
                          </span>
                        ) : (
                          <span className={`badge ${u.isActive ? 'badge-success' : 'badge-danger'}`}>
                            {u.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="stat-icon" style={{ background: '#e7f1ff', color: '#0d6efd' }}>
            <ShieldCheck size={20} />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-800 m-0">Administrative tools</p>
            <p className="text-xs text-slate-500 m-0">
              {s.activePickups} active pickup{s.activePickups === 1 ? '' : 's'} · {s.totalPickups} total pickup tasks
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/users" className="btn btn-sm btn-outline no-underline">User management</Link>
          <Link to="/admin/reports" className="btn btn-sm btn-primary no-underline">Full reports</Link>
        </div>
      </div>
    </div>
  );
}