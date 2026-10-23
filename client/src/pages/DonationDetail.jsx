import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Boxes,
  Phone,
  User,
  ShieldCheck,
  Warehouse,
  FileText,
  Eye,
  Handshake,
  Info,
} from 'lucide-react';
import { donationsAPI, ngoAPI, getApiErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { LoadingBlock, ErrorNotice } from '../components/ui';
import { Spinner } from '../components/ui';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatDateTime, formatQuantity, isPast, timeLeft, statusMeta } from '../utils/format';

/**
 * Donation detail page.
 * - Anonymous visitors see only public fields.
 * - Logged-in donors/NGOs/volunteers/admins see full contact details when the
 *   backend grants access, plus the timeline (history) for authorised users.
 */
export default function DonationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [donation, setDonation] = useState(null);
  const [fullAccess, setFullAccess] = useState(false);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmAccept, setConfirmAccept] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await donationsAPI.get(id);
      setDonation(res.data.donation);
      setFullAccess(res.data.hasFullAccess);
      if (res.data.hasFullAccess) {
        try {
          const h = await donationsAPI.history(id);
          setHistory(h.data.history);
        } catch {
          setHistory([]); // timeline is optional
        }
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load this donation.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const acceptDonation = async () => {
    setBusy(true);
    try {
      await ngoAPI.accept(id);
      toast.success('Donation accepted — it now belongs to your NGO.');
      navigate('/ngo/accepted');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not accept this donation.'));
      load(); // refresh in case someone else accepted it first
    } finally {
      setBusy(false);
      setConfirmAccept(false);
    }
  };

  if (loading) return <div className="shell py-12"><LoadingBlock label="Loading donation…" /></div>;
  if (error || !donation)
    return (
      <div className="shell py-12">
        <ErrorNotice message={error || 'Donation not found.'} onRetry={load} />
        <div className="mt-4 text-center">
          <Link to="/donations" className="btn btn-outline no-underline">
            <ArrowLeft size={16} /> Back to donations
          </Link>
        </div>
      </div>
    );

  const expired = donation.isExpired || isPast(donation.safeConsumptionDeadline);
  const canAccept =
    user?.role === 'NGO' && donation.status === 'AVAILABLE' && !expired;
  const isOwner = user && donation.donorId && (donation.donorId._id || donation.donorId) === user._id;

  const Row = ({ icon: Icon, label, children }) => (
    <div className="flex gap-3 py-2.5 border-b border-line last:border-0">
      <Icon size={17} className="text-primary shrink-0 mt-0.5" />
      <div className="text-sm">
        <p className="text-slate-400 m-0 text-xs uppercase tracking-wider font-semibold">{label}</p>
        <p className="text-slate-800 m-0 mt-0.5">{children}</p>
      </div>
    </div>
  );

  return (
    <div className="shell py-10">
      <Link to="/donations" className="link no-underline text-sm inline-flex items-center gap-1">
        <ArrowLeft size={15} /> Back to available donations
      </Link>

      <div className="grid gap-6 lg:grid-cols-3 mt-4">
        {/* Main card */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="badge badge-neutral">{donation.category}</span>
                <StatusBadge status={donation.status} />
                {expired ? <span className="badge badge-danger">Expired</span> : null}
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 mt-3 m-0">{donation.foodName}</h1>
              {donation.description ? (
                <p className="text-slate-600 mt-2 leading-relaxed">{donation.description}</p>
              ) : null}
            </div>
            <div className="text-right">
              <p className="text-3xl font-extrabold text-primary-dark m-0">
                {formatQuantity(donation.quantity, donation.unit)}
              </p>
              <p className="text-xs text-slate-500 m-0">
                {donation.foodClassification === 'NON_VEG' ? 'Non-vegetarian' : donation.foodClassification === 'BOTH' ? 'Veg + Non-veg' : 'Vegetarian'}
              </p>
            </div>
          </div>

          {donation.imageUrl ? (
            <img
              src={donation.imageUrl}
              alt={donation.foodName}
              className="mt-4 rounded-xl w-full max-h-72 object-cover border border-line"
            />
          ) : null}

          <div className="mt-4 grid sm:grid-cols-2 gap-x-6">
            <Row icon={MapPin} label="Pickup location">
              {fullAccess ? (
                <>
                  {donation.pickupAddress}
                  {donation.city ? <>, {donation.city}</> : null}
                  {donation.locationDescription ? (
                    <span className="block text-xs text-slate-500 mt-0.5">{donation.locationDescription}</span>
                  ) : null}
                </>
              ) : (
                <>
                  {donation.city}
                  <span className="block text-xs text-slate-500 mt-0.5">
                    Full address is shared after an NGO accepts the donation.
                  </span>
                </>
              )}
            </Row>
            <Row icon={Clock} label="Safe-consumption deadline">
              <span className={expired ? 'text-red-600 font-semibold' : ''}>
                {formatDateTime(donation.safeConsumptionDeadline)} · {expired ? 'deadline passed' : timeLeft(donation.safeConsumptionDeadline)}
              </span>
            </Row>
            {donation.availableFrom ? (
              <Row icon={Clock} label="Available from">{formatDateTime(donation.availableFrom)}</Row>
            ) : null}
            {donation.preparationDate ? (
              <Row icon={Clock} label="Prepared at">{formatDateTime(donation.preparationDate)}</Row>
            ) : null}
            <Row icon={Warehouse} label="Storage information">
              {donation.storageInformation || 'Not specified by the donor.'}
            </Row>
            <Row icon={FileText} label="Listed at">{formatDateTime(donation.createdAt)}</Row>
          </div>

          {/* Food safety notice */}
          <div className="alert alert-warning mt-4 flex gap-2" role="note">
            <Info size={17} className="shrink-0 mt-0.5" />
            <p className="m-0 text-sm">
              Food-safety notice: this listing reflects information provided by the donor. Donors and
              receiving organisations are responsible for following applicable food-safety requirements.
              Food past its safe-consumption deadline cannot be accepted on this platform.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 mt-5">
            {canAccept ? (
              <button type="button" className="btn btn-primary" onClick={() => setConfirmAccept(true)}>
                <Handshake size={17} /> Accept this donation
              </button>
            ) : null}
            {isOwner ? (
              <Link to={`/donor/donations/${donation._id}/edit`} className="btn btn-outline no-underline">
                Edit donation
              </Link>
            ) : null}
            {!user ? (
              <>
                <Link to={`/login?from=/donations/${donation._id}`} className="btn btn-primary no-underline">
                  Login as an NGO to accept
                </Link>
                <Link to="/register?role=NGO" className="btn btn-outline no-underline">Register as NGO</Link>
              </>
            ) : null}
            {user?.role === 'VOLUNTEER' ? (
              <Link to="/volunteer/tasks" className="btn btn-outline no-underline">See pickup tasks</Link>
            ) : null}
            {user?.role === 'NGO' && donation.status === 'AVAILABLE' && expired ? (
              <span className="btn btn-outline" aria-disabled="true">Deadline passed</span>
            ) : null}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Contact / parties */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider m-0">Contact details</h3>
            <div className="mt-3">
              {fullAccess ? (
                <>
                  <Row icon={User} label="Contact person">{donation.contactName || '—'}</Row>
                  <Row icon={Phone} label="Phone">{donation.contactPhone || '—'}</Row>
                </>
              ) : (
                <div className="flex gap-3 py-2.5">
                  <ShieldCheck size={17} className="text-primary shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-600 m-0">
                    Phone numbers are hidden from the public and shared only with the authorised NGO,
                    assigned volunteer and administrators.
                  </p>
                </div>
              )}
              {donation.donorId ? (
                <Row icon={User} label="Donor">
                  {typeof donation.donorId === 'object' ? donation.donorId.name || 'Donor' : 'Donor'}
                </Row>
              ) : null}
              {donation.acceptedByNgoId ? (
                <Row icon={Handshake} label="Accepted by">
                  {typeof donation.acceptedByNgoId === 'object'
                    ? donation.acceptedByNgoId.organizationName || donation.acceptedByNgoId.name
                    : 'An NGO'}
                </Row>
              ) : null}
            </div>
          </div>

          {/* Timeline */}
          {fullAccess && history.length > 0 ? (
            <div className="card p-5">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider m-0">Status history</h3>
              <ol className="mt-3 list-none p-0 space-y-3">
                {history.slice().reverse().map((h) => (
                  <li key={h._id} className="flex gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div>
                      <span className={`badge ${statusMeta(h.newStatus).badge}`}>{statusMeta(h.newStatus).label}</span>
                      {h.note ? <p className="text-xs text-slate-600 m-0 mt-1">{h.note}</p> : null}
                      <p className="text-[11px] text-slate-400 m-0 mt-0.5">
                        {formatDateTime(h.timestamp)}
                        {h.updatedByRole ? ` · by ${h.updatedByRole}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : !fullAccess ? (
            <div className="card p-5">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider m-0">Status history</h3>
              <p className="text-sm text-slate-500 flex gap-2 mt-2">
                <Eye size={16} className="shrink-0 mt-0.5 text-primary" />
                The audit trail is visible to the donor, the accepting NGO, the assigned volunteer and
                administrators.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={confirmAccept}
        title="Accept this donation?"
        message={`Your NGO will become the owner of "${donation.foodName}". No other NGO can accept it afterwards.`}
        confirmLabel={busy ? 'Accepting…' : 'Accept donation'}
        danger={false}
        busy={busy}
        onConfirm={acceptDonation}
        onCancel={() => setConfirmAccept(false)}
      />
    </div>
  );
}