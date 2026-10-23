/**
 * Shared field definitions + renderer for the donation form.
 * Used by both AddDonation and EditDonation so the two stay in sync.
 */
import { Info } from 'lucide-react';

export const EMPTY_DONATION = {
  foodName: '',
  category: 'Cooked Meals',
  description: '',
  quantity: '',
  unit: 'Servings',
  foodClassification: 'VEG',
  preparationDate: '',
  availableFrom: '',
  safeConsumptionDeadline: '',
  pickupAddress: '',
  city: '',
  locationDescription: '',
  storageInformation: '',
  contactName: '',
  contactPhone: '',
  additionalNotes: '',
};

export const validateDonationForm = (form) => {
  const errors = {};
  if (!form.foodName.trim()) errors.foodName = 'Food name is required.';
  if (!form.quantity || Number(form.quantity) <= 0) errors.quantity = 'Quantity must be greater than 0.';
  if (!form.safeConsumptionDeadline) errors.safeConsumptionDeadline = 'Safe-consumption deadline is required.';
  else if (new Date(form.safeConsumptionDeadline).getTime() <= Date.now())
    errors.safeConsumptionDeadline = 'The deadline must be in the future.';
  if (form.preparationDate && form.safeConsumptionDeadline &&
      new Date(form.preparationDate).getTime() > new Date(form.safeConsumptionDeadline).getTime())
    errors.preparationDate = 'Preparation time cannot be after the safe-consumption deadline.';
  if (!form.pickupAddress.trim()) errors.pickupAddress = 'Pickup address is required.';
  if (!form.city.trim()) errors.city = 'City is required.';
  if (!form.contactName.trim()) errors.contactName = 'Contact name is required.';
  if (!/^[0-9+\-\s()]{7,15}$/.test(form.contactPhone)) errors.contactPhone = 'Valid contact phone is required.';
  return errors;
};

/** Food-safety notice shown at the top of the form. */
export function FoodSafetyNotice() {
  return (
    <div className="alert alert-warning flex gap-2" role="note">
      <Info size={18} className="shrink-0 mt-0.5" />
      <p className="m-0 text-sm">
        <strong>Food safety first:</strong> only list food that is suitable for safe consumption. Provide
        accurate preparation times and the deadline by which the food should be consumed. Listings that are
        past their deadline are hidden from NGOs and cannot be accepted.
      </p>
    </div>
  );
}

/** Renders the shared form fields. `form` is the state object, `update` the change handler. */
export function DonationFields({ form, update, errors = {}, meta }) {
  const field = (name) => ({ id: name, name, value: form[name] ?? '', onChange: update });
  const err = (name) => (errors[name] ? <p className="field-error">{errors[name]}</p> : null);

  return (
    <>
      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Food information</h3>
      <div className="form-row form-row-2">
        <div>
          <label className="field-label" htmlFor="foodName">Food name *</label>
          <input id="foodName" className={`input ${errors.foodName ? 'input-error' : ''}`} {...field('foodName')} placeholder="e.g. Vegetable Pulao" />
          {err('foodName')}
        </div>
        <div>
          <label className="field-label" htmlFor="category">Food category *</label>
          <select id="category" name="category" className="select" value={form.category} onChange={update}>
            {meta.foodCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <label className="field-label" htmlFor="description">Description</label>
        <textarea id="description" name="description" className="textarea" value={form.description} onChange={update} placeholder="What exactly is available? How is it packed?" />
      </div>

      <div className="form-row form-row-3 mt-4">
        <div>
          <label className="field-label" htmlFor="quantity">Quantity *</label>
          <input id="quantity" name="quantity" type="number" min="0.1" step="0.1" className={`input ${errors.quantity ? 'input-error' : ''}`} value={form.quantity} onChange={update} placeholder="e.g. 40" />
          {err('quantity')}
        </div>
        <div>
          <label className="field-label" htmlFor="unit">Unit *</label>
          <select id="unit" name="unit" className="select" value={form.unit} onChange={update}>
            {meta.units.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="foodClassification">Classification</label>
          <select id="foodClassification" name="foodClassification" className="select" value={form.foodClassification} onChange={update}>
            <option value="VEG">Vegetarian</option>
            <option value="NON_VEG">Non-vegetarian</option>
            <option value="BOTH">Both</option>
          </select>
        </div>
      </div>

      <hr className="divider" />
      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Timing (food safety)</h3>
      <div className="form-row form-row-3">
        <div>
          <label className="field-label" htmlFor="preparationDate">Prepared at</label>
          <input id="preparationDate" name="preparationDate" type="datetime-local" className={`input ${errors.preparationDate ? 'input-error' : ''}`} value={form.preparationDate} onChange={update} />
          {err('preparationDate')}
        </div>
        <div>
          <label className="field-label" htmlFor="availableFrom">Available from</label>
          <input id="availableFrom" name="availableFrom" type="datetime-local" className="input" value={form.availableFrom} onChange={update} />
        </div>
        <div>
          <label className="field-label" htmlFor="safeConsumptionDeadline">Safe-consumption deadline *</label>
          <input id="safeConsumptionDeadline" name="safeConsumptionDeadline" type="datetime-local" className={`input ${errors.safeConsumptionDeadline ? 'input-error' : ''}`} value={form.safeConsumptionDeadline} onChange={update} />
          {err('safeConsumptionDeadline')}
        </div>
      </div>
      <p className="field-hint">After this time the listing expires automatically and NGOs can no longer accept it.</p>

      <hr className="divider" />
      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Pickup details</h3>
      <div className="form-row form-row-2">
        <div>
          <label className="field-label" htmlFor="pickupAddress">Pickup address *</label>
          <input id="pickupAddress" className={`input ${errors.pickupAddress ? 'input-error' : ''}`} {...field('pickupAddress')} placeholder="Street, area, landmark" />
          {err('pickupAddress')}
        </div>
        <div>
          <label className="field-label" htmlFor="city">City *</label>
          <input id="city" className={`input ${errors.city ? 'input-error' : ''}`} {...field('city')} placeholder="e.g. Pune" />
          {err('city')}
        </div>
      </div>
      <div className="mt-4">
        <label className="field-label" htmlFor="locationDescription">Location description</label>
        <input id="locationDescription" name="locationDescription" className="input" value={form.locationDescription} onChange={update} placeholder="e.g. Rear service entrance, ask at reception" />
      </div>
      <div className="mt-4">
        <label className="field-label" htmlFor="storageInformation">Storage information</label>
        <input id="storageInformation" name="storageInformation" className="input" value={form.storageInformation} onChange={update} placeholder="e.g. Keep covered & warm, serve within 4 hours" />
      </div>

      <hr className="divider" />
      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Contact details</h3>
      <div className="form-row form-row-2">
        <div>
          <label className="field-label" htmlFor="contactName">Contact person *</label>
          <input id="contactName" className={`input ${errors.contactName ? 'input-error' : ''}`} {...field('contactName')} placeholder="Person to ask for at pickup" />
          {err('contactName')}
        </div>
        <div>
          <label className="field-label" htmlFor="contactPhone">Contact phone *</label>
          <input id="contactPhone" className={`input ${errors.contactPhone ? 'input-error' : ''}`} {...field('contactPhone')} placeholder="e.g. 98765 43210" />
          {err('contactPhone')}
        </div>
      </div>
      <p className="field-hint">Visible only to authorised NGOs, the assigned volunteer and administrators.</p>

      <div className="mt-4">
        <label className="field-label" htmlFor="additionalNotes">Additional notes</label>
        <textarea id="additionalNotes" name="additionalNotes" className="textarea" value={form.additionalNotes} onChange={update} placeholder="Anything the NGO or volunteer should know" />
      </div>
    </>
  );
}