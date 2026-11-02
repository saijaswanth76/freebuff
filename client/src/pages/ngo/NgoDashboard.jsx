import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Handshake, Bike, PackageCheck, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { LoadingBlock, ErrorNotice, EmptyState } from '../../components/ui';
import { ngoAPI, getApiErrorMessage } from '../../services/api';
import { formatDateTime } from '../../utils/format';

/** NGO dashboard: stats + recent activity straight from /api/ngo/dashboard. */
export default function NgoDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await ngoAPI.dashboard();
      setData(res.data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load your dashboard.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingBlock label="Loading your NGO dashboard…" />;
  if (error) return <ErrorNotice message={error} onRetry={load} />;

  const stats = data.stats;
  const verificationStatus = data.ngo?.verificationStatus;

  return (
    <div className="space-y-6">
      {verificationStatus === 'PENDING' ? (
        <div className="alert alert-warning flex gap-3" role="note">
          <ShieldAlert size={20} className="shrink-0 mt-0.5" />
          <div>
            <p className="m-0 font-semibold text-slate-900">Your NGO registration is awaiting administrator verification</p>
            <p className="m-0 text-sm text-slate-600 mt-1">
              You can already browse available donations and accept them while your account is reviewed.
              Once an administrator verifies your organization, you will have full access to coordinate pickup
              and distribution. Check back here for the update.
            </p>
          </div>
        </div>
      ) : verificationStatus === 'VERIFIED' ? (
        <div className="alert alert-success flex gap-3" role="note">
          <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
          <p className="m-0 text-sm">
            <strong className="text-slate-900">Your organization is verified.</strong> You have full access to
            coordinate pickup and distribution for the donations you accept.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Search} label="Available donations" value={stats.availableDonations} tone="blue" hint="Open for acceptance" />
        <StatCard icon={Handshake} label="Accepted by us" value={stats.acceptedDonations} tone="green" />
        <StatCard icon={Bike} label="Pending pickups" value={stats.pendingPickups} tone="amber" />
        <StatCard icon={PackageCheck} label="Completed distributions" value={stats.completedDistributions} tone="green" />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/ngo/browse" className="btn btn-primary no-underline">
          <Search size={17} /> Browse Donations
        </Link>
        <Link to="/ngo/accepted" className="btn btn-outline-primary no-underline">
          <Handshake size={17} /> Accepted Donations
        </Link>
        <Link to="/ngo/history" className="btn btn-outline no-underline">
          <PackageCheck size={17} /> Distribution History
        </Link>
      </div>

      {/* Status breakdown */}
      <div className="card p-5">
        <h2 className="text-lg font-bold text-slate-900 m-0">Our donations by status</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-4">
          {Object.keys(stats.byStatus || {}).length === 0 ? (
            <p className="text-sm text-slate-500 m-0">No donations accepted yet — start browsing available food.</p>
          ) : (
            Object.entries(stats.byStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between gap-3 border border-line rounded-xl px-4 py-3">
                <StatusBadge status={status} />
                <span className="text-lg font-extrabold text-slate-900">{count}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-bold text-slate-900 m-0">Recent activity</h2>
          <Link to="/ngo/accepted" className="link no-underline text-sm flex items-center gap-1">
            Open accepted list <ArrowRight size={15} />
          </Link>
        </div>

        {data.recentActivities.length === 0 ? (
          <EmptyState
            icon={<Handshake size={28} />}
            title="No accepted donations yet"
            description="When you accept a donation it appears here so you can coordinate pickup and delivery."
            action={
              <Link to="/ngo/browse" className="btn btn-primary no-underline">
                <Search size={17} /> Browse Donations
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
                </tr>
              </thead>
              <tbody>
                {data.recentActivities.map((d) => (
                  <tr key={d._id}>
                    <td className="font-semibold text-slate-800">
                      <Link to={`/donations/${d._id}`} className="link no-underline">{d.foodName}</Link>
                    </td>
                    <td>{d.quantity} {d.unit}</td>
                    <td>{d.city}</td>
                    <td className="text-sm text-slate-500">{formatDateTime(d.safeConsumptionDeadline)}</td>
                    <td><StatusBadge status={d.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}