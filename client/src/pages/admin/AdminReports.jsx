import { useCallback, useEffect, useState } from 'react';
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
import { FileBarChart2, CalendarRange, Percent, PackageCheck } from 'lucide-react';
import StatCard from '../../components/StatCard';
import { LoadingBlock, ErrorNotice, Spinner } from '../../components/ui';
import { adminAPI, getApiErrorMessage } from '../../services/api';

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
const CATEGORY_COLORS = ['#ea580c', '#0D6EFD', '#F59F00', '#7048E8', '#DC3545', '#0958D9', '#6C757D'];
const TOOLTIP = { contentStyle: { borderRadius: 10, border: '1px solid #e6ebf1', fontSize: 13 } };

/** Admin: platform reports with date-range filtering (all numbers aggregated from MongoDB). */
export default function AdminReports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [range, setRange] = useState({ from: '', to: '' });

  const load = useCallback(async (nextRange = range) => {
    setBusy(true);
    setError('');
    try {
      const params = {};
      if (nextRange.from) params.from = nextRange.from;
      if (nextRange.to) params.to = nextRange.to;
      const res = await adminAPI.reports(params);
      setData(res.data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load the report.'));
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }, [range]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <LoadingBlock label="Calculating reports from the database…" />;
  if (error) return <ErrorNotice message={error} onRetry={() => load()} />;

  const summary = data.summary;
  const monthData = data.donationsByMonth.map((r) => ({ month: r.month, Donations: r.value }));
  const userMonthData = data.usersByMonth.map((r) => ({ month: r.month, Users: r.value }));
  const pieData = data.donationsByStatus
    .filter((r) => r.count > 0)
    .map((r) => ({ name: r.status, value: r.count, fill: STATUS_COLORS[r.status] || '#94A3B8' }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 m-0">Reports &amp; Statistics</h2>
          <p className="text-sm text-slate-500 m-0">Every figure below is aggregated from real records in MongoDB.</p>
        </div>
        <span className="flex items-center gap-2">
          <FileBarChart2 size={18} className="text-primary" />
          {busy ? <Spinner small label="Refreshing…" /> : <span className="badge badge-neutral">Live data</span>}
        </span>
      </div>

      {/* Date range filter */}
      <div className="card p-4 md:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="field-label" htmlFor="repFrom">
              <span className="inline-flex items-center gap-1"><CalendarRange size={13} /> From</span>
            </label>
            <input id="repFrom" type="date" className="input" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
          </div>
          <div>
            <label className="field-label" htmlFor="repTo">To</label>
            <input id="repTo" type="date" className="input" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
          </div>
          <button type="button" className="btn btn-primary" onClick={() => load(range)} disabled={busy}>
            Apply range
          </button>
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy || (!range.from && !range.to)}
            onClick={() => {
              const cleared = { from: '', to: '' };
              setRange(cleared);
              load(cleared);
            }}
          >
            All time
          </button>
        </div>
        {data.filters.from || data.filters.to ? (
          <p className="text-xs text-slate-500 mt-2 mb-0">
            Showing records from {data.filters.from ? new Date(data.filters.from).toLocaleDateString() : 'the beginning'} to{' '}
            {data.filters.to ? new Date(data.filters.to).toLocaleDateString() : 'today'} — note: monthly charts always
            show the last six months.
          </p>
        ) : null}
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={PackageCheck} label="Total donations" value={summary.totalDonations} tone="green" />
        <StatCard icon={PackageCheck} label="Completed donations" value={summary.completedDonations} tone="blue" />
        <StatCard icon={CalendarRange} label="Pending donations" value={summary.pendingDonations} tone="amber" />
        <StatCard icon={Percent} label="Completion rate" value={`${summary.completionRate}%`} tone="green" hint="Completed ÷ total" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FileBarChart2} label="Cancelled / rejected" value={summary.cancelledDonations} tone="red" />
        <StatCard icon={PackageCheck} label="In progress" value={summary.inProgressDonations} tone="slate" hint="Collected & distributed" />
        <StatCard icon={CalendarRange} label="Users in range" value={summary.totalUsers} tone="blue" />
        <StatCard icon={PackageCheck} label="Quantity listed" value={summary.totalQuantityListed} tone="green" hint="Sum of quantities in range" />
      </div>

      {/* Charts */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="text-lg font-bold text-slate-900 m-0 mb-4">Donations by month</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
                <XAxis dataKey="month" fontSize={11} tick={{ fill: '#6C757D' }} />
                <YAxis allowDecimals={false} fontSize={11} tick={{ fill: '#6C757D' }} />
                <Tooltip {...TOOLTIP} />
                <Line type="monotone" dataKey="Donations" stroke="#ea580c" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-lg font-bold text-slate-900 m-0 mb-4">User registrations by month</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={userMonthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
                <XAxis dataKey="month" fontSize={11} tick={{ fill: '#6C757D' }} />
                <YAxis allowDecimals={false} fontSize={11} tick={{ fill: '#6C757D' }} />
                <Tooltip {...TOOLTIP} />
                <Bar dataKey="Users" fill="#0D6EFD" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="text-lg font-bold text-slate-900 m-0 mb-4">Donations by category</h3>
          <div className="table-shell" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Total</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {data.donationsByCategory.length === 0 ? (
                  <tr><td colSpan={3} className="text-center text-slate-500">No donations in this range.</td></tr>
                ) : (
                  data.donationsByCategory.map((row, idx) => (
                    <tr key={row.category}>
                      <td>
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }} />
                          {row.category}
                        </span>
                      </td>
                      <td className="font-semibold">{row.count}</td>
                      <td className="text-green-700 font-semibold">{row.completed}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-lg font-bold text-slate-900 m-0 mb-4">Status distribution</h3>
          <div style={{ height: 260 }}>
            {pieData.length === 0 ? (
              <p className="text-sm text-slate-500 text-center">No donations in this range.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={95}>
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip {...TOOLTIP} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-lg font-bold text-slate-900 m-0 mb-1">Donations by status (numbers)</h3>
        <div className="flex flex-wrap gap-2 mt-3">
          {data.donationsByStatus.map((row) => (
            <span key={row.status} className="badge badge-neutral" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
              {row.status}: <strong className="ml-1">{row.count}</strong>
            </span>
          ))}
          {data.donationsByStatus.length === 0 ? <span className="text-sm text-slate-500">No donations in this range.</span> : null}
        </div>
      </div>
    </div>
  );
}