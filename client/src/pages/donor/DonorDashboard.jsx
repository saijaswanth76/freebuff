import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HandHeart,
  PlusCircle,
  Handshake,
  ShieldCheck,
  PackageX,
  Clock,
  AlertCircle,
} from 'lucide-react';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { LoadingBlock, ErrorNotice, EmptyState } from '../../components/ui';
import { donationsAPI, getApiErrorMessage } from '../../services/api';
import { formatDateTime, statusMeta } from '../../utils/format';

/**
 * Donor dashboard: totals come from /api/donations/my summary, which the
 * backend aggregates from the donor's own records in MongoDB.
 */
export default function DonorDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryRes, recentRes] = await Promise.all([
        donationsAPI.my({ limit: 1 }),
        donationsAPI.my({ limit: 5, sort: 'newest', ...{} }),
      ]);
      setData({ summary: summaryRes.data.summary, recent: recentRes.data.donations });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load your dashboard.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingBlock label="Loading your dashboard…" />;
  if (error) return <ErrorNotice message={error} onRetry={load} />;

  const s = data.summary;
  const active = s.AVAILABLE + s.ACCEPTED + s.PICKUP_ASSIGNED + s.COLLECTED + s.DISTRIBUTED;

  return (
    <div className="space-y-6">
      {/* Primary action */}
      <div className="card p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 m-0">Have surplus food today?</h2>
          <p className="text-sm text-slate-500 m-0">Register it in under a minute — NGOs nearby will see it immediately.</p>
        </div>
        <Link to="/donor/donations/new" className="btn btn-primary no-underline">
          <PlusCircle size={17} /> Add New Donation
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={HandHeart} label="Total donations" value={s.total} tone="green" />
        <StatCard icon={Clock} label="Available" value={s.AVAILABLE} tone="blue" hint="Awaiting an NGO" />
        <StatCard icon={Handshake} label="Accepted & in progress" value={s.ACCEPTED + s.PICKUP_ASSIGNED + s.COLLECTED + s.DISTRIBUTED} tone="amber" />
        <StatCard icon={ShieldCheck} label="Completed" value={s.COMPLETED} tone="green" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={PackageX} label="Cancelled" value={s.CANCELLED} tone="slate" />
        <StatCard icon={AlertCircle} label="Rejected" value={s.REJECTED} tone="red" />
        <StatCard icon={HandHeart} label="Active listings" value={active} tone="blue" />
      </div>

      {/* Recent activity */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-bold text-slate-900 m-0">Recent donation activity</h2>
          <Link to="/donor/donations" className="link no-underline text-sm">View all</Link>
        </div>

        {data.recent.length === 0 ? (
          <EmptyState
            icon={<PlusCircle size={28} />}
            title="No donations yet"
            description="Create your first donation and it will appear here with a live status."
            action={
              <Link to="/donor/donations/new" className="btn btn-primary no-underline">
                <PlusCircle size={17} /> Add New Donation
              </Link>
            }
          />
        ) : (
          <div className="table-shell mt-4">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Food</th>
                  <th>Quantity</th>
                  <th>City</th>
                  <th>Deadline</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((d) => (
                  <tr key={d._id}>
                    <td className="font-semibold text-slate-800">{d.foodName}</td>
                    <td>{d.quantity} {d.unit}</td>
                    <td>{d.city}</td>
                    <td className="text-sm text-slate-500">{formatDateTime(d.safeConsumptionDeadline)}</td>
                    <td><StatusBadge status={d.status} /></td>
                    <td>
                      <Link to={`/donations/${d._id}`} className="link no-underline text-sm">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Workflow reminder */}
      <div className="card p-5">
        <h2 className="text-lg font-bold text-slate-900 m-0 mb-3">Where do my donations stand?</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          {[
            ['AVAILABLE', 'Listed for NGOs to accept'],
            ['ACCEPTED', 'An NGO claimed it'],
            ['COLLECTED', 'A volunteer picked it up'],
            [statusMeta('COMPLETED').label, 'Distribution confirmed'],
          ].map(([status, text]) => (
            <div key={status} className="flex items-start gap-2">
              <StatusBadge status={status} />
              <span className="text-slate-500 text-xs">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}