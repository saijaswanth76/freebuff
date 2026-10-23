import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ImagePlus, PlusCircle, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { donationsAPI, statsAPI, getApiErrorMessage } from '../../services/api';
import { Spinner } from '../../components/ui';
import {
  EMPTY_DONATION,
  FoodSafetyNotice,
  DonationFields,
  validateDonationForm,
} from './DonationFormFields';

/** Donor: create a new food donation (multipart form, optional image). */
export default function AddDonation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const fileRef = useRef(null);

  const [meta, setMeta] = useState({ foodCategories: [], units: [] });
  const [form, setForm] = useState({
    ...EMPTY_DONATION,
    city: user?.city || '',
    pickupAddress: user?.address || '',
    contactName: user?.name || '',
    contactPhone: user?.phone || '',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    statsAPI.meta().then((res) => setMeta(res.data)).catch(() => {});
  }, []);

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const update = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const pickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      toast.error('Only JPEG, PNG, WEBP or GIF images are allowed.');
      e.target.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be 2 MB or smaller.');
      e.target.value = '';
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setFormError('');
    const nextErrors = validateDonationForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFormError('Please fix the highlighted fields before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = { ...form };
      if (!payload.preparationDate) delete payload.preparationDate;
      if (!payload.availableFrom) delete payload.availableFrom;

      const res = await donationsAPI.create(payload);

      // Upload the picture in a second step (text-only create first keeps the
      // request and validation simple and readable for students).
      if (image) {
        const img = new FormData();
        img.append('image', image);
        try {
          await donationsAPI.update(res.data.donation._id, img);
        } catch (uploadError) {
          toast.warning(`Donation saved, but the image could not be uploaded: ${getApiErrorMessage(uploadError)}`);
        }
      }

      toast.success('Donation created successfully — it is now visible to NGOs.');
      navigate('/donor/donations');
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'Could not create the donation.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 m-0">Add a food donation</h2>
          <p className="text-sm text-slate-500 m-0">All fields marked * are required by the backend.</p>
        </div>
        <Link to="/donor/donations" className="btn btn-sm btn-outline no-underline">
          <X size={15} /> Cancel
        </Link>
      </div>

      <div className="card p-5 md:p-6">
        <FoodSafetyNotice />
        {formError ? <div className="alert alert-danger mt-4" role="alert">{formError}</div> : null}

        <form onSubmit={submit} noValidate className="mt-5">
          <DonationFields form={form} update={update} errors={errors} meta={meta} />

          <hr className="divider" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Food image (optional)</h3>
          <div className="flex items-center gap-4 flex-wrap">
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="Selected food" className="w-40 h-28 object-cover rounded-xl border border-line" />
                <button
                  type="button"
                  onClick={() => {
                    setImage(null);
                    setImagePreview('');
                    if (fileRef.current) fileRef.current.value = '';
                  }}
                  className="absolute -top-2 -right-2 bg-white border border-line rounded-full p-1 shadow"
                  aria-label="Remove image"
                >
                  <X size={14} />
                </button>
              </div>
            ) : null}
            <button type="button" className="btn btn-outline" onClick={() => fileRef.current?.click()}>
              <ImagePlus size={17} /> {image ? 'Change image' : 'Choose image'}
            </button>
            <span className="text-xs text-slate-400">JPEG / PNG / WEBP, max 2 MB</span>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={pickImage} className="hidden" />
          </div>

          <div className="flex gap-3 mt-6">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <><Spinner small label="" /> Saving…</> : <><PlusCircle size={17} /> Create donation</>}
            </button>
            <Link to="/donor/donations" className="btn btn-outline no-underline">Back to my donations</Link>
          </div>
        </form>
      </div>
    </div>
  );
}