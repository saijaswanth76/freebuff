import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save, X, ArrowLeft } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { donationsAPI, statsAPI, getApiErrorMessage } from '../../services/api';
import { LoadingBlock, ErrorNotice, Spinner } from '../../components/ui';
import StatusBadge from '../../components/StatusBadge';
import { formatDateTime, toDateTimeLocal } from '../../utils/format';
import {
  FALLBACK_FOOD_CATEGORIES,
  FALLBACK_UNITS,
  mergeMeta,
} from '../../utils/metaFallbacks';
import {
  EMPTY_DONATION,
  FoodSafetyNotice,
  DonationFields,
  validateDonationForm,
} from './DonationFormFields';

/**
 * Donor: edit a donation. The backend only allows editing while the donation
 * is still AVAILABLE; the UI reflects the same rule.
 */
export default function EditDonation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [meta, setMeta] = useState({
    foodCategories: FALLBACK_FOOD_CATEGORIES,
    units: FALLBACK_UNITS,
  });
  const [form, setForm] = useState(EMPTY_DONATION);
  const [donation, setDonation] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    statsAPI
      .meta()
      .then((res) => setMeta((prev) => mergeMeta(prev, res.data)))
      .catch(() => {
        /* keep the static fallbacks */
      });
  }, []);

  const load = async () => {
    setLoading(true);
    setFormError('');
    try {
      const res = await donationsAPI.get(id);
      const d = res.data.donation;
      setDonation(d);
      setForm({
        foodName: d.foodName || '',
        category: d.category || 'Cooked Meals',
        description: d.description || '',
        quantity: d.quantity ?? '',
        unit: d.unit || 'Servings',
        foodClassification: d.foodClassification || 'VEG',
        preparationDate: toDateTimeLocal(d.preparationDate),
        availableFrom: toDateTimeLocal(d.availableFrom),
        safeConsumptionDeadline: toDateTimeLocal(d.safeConsumptionDeadline),
        pickupAddress: d.pickupAddress || '',
        city: d.city || '',
        locationDescription: d.locationDescription || '',
        storageInformation: d.storageInformation || '',
        contactName: d.contactName || '',
        contactPhone: d.contactPhone || '',
        additionalNotes: d.additionalNotes || '',
      });
      if (d.status !== 'AVAILABLE') {
        setFormError('This donation has already been accepted and can no longer be edited.');
      }
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'Could not load the donation.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const update = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setFormError('');
    const nextErrors = validateDonationForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFormError('Please fix the highlighted fields before saving.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = { ...form };
      if (!payload.preparationDate) delete payload.preparationDate;
      if (!payload.availableFrom) delete payload.availableFrom;
      await donationsAPI.update(id, payload);
      toast.success('Donation updated successfully.');
      navigate('/donor/donations');
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'Could not update the donation.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingBlock label="Loading donation…" />;
  if (!donation)
    return (
      <div>
        <ErrorNotice message={formError || 'Donation not found.'} onRetry={load} />
        <Link to="/donor/donations" className="btn btn-outline no-underline mt-4">
          <ArrowLeft size={16} /> Back to my donations
        </Link>
      </div>
    );

  const editable = donation.status === 'AVAILABLE';

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-extrabold text-slate-900 m-0">Edit donation</h2>
          <StatusBadge status={donation.status} />
        </div>
        <Link to="/donor/donations" className="btn btn-sm btn-outline no-underline">
          <X size={15} /> Close
        </Link>
      </div>

      <div className="card p-5 md:p-6">
        <FoodSafetyNotice />
        {formError ? <div className="alert alert-danger mt-4" role="alert">{formError}</div> : null}
        {!editable ? (
          <div className="alert alert-warning mt-4 flex items-center justify-between gap-3">
            <p className="m-0">
              Only donations that have not been accepted can be edited (last updated {formatDateTime(donation.statusUpdatedAt)}).
            </p>
            <Link to={`/donations/${id}`} className="btn btn-sm btn-outline no-underline">View</Link>
          </div>
        ) : null}

        <form onSubmit={submit} noValidate className="mt-5">
          <fieldset disabled={!editable} className="border-0 p-0 m-0 disabled:opacity-70">
            <DonationFields form={form} update={update} errors={errors} meta={meta} />
          </fieldset>

          <div className="flex gap-3 mt-6">
            <button type="submit" className="btn btn-primary" disabled={submitting || !editable}>
              {submitting ? <><Spinner small label="" /> Saving…</> : <><Save size={17} /> Save changes</>}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => navigate('/donor/donations')}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}