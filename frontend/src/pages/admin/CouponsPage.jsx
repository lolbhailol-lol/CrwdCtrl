import { useEffect, useMemo, useState } from 'react';
import { Tag, Plus, Users, Percent, Info } from 'lucide-react';
import { adminFetchJSON } from '../../utils/adminApi';

const ENTITY_OPTIONS = [
  { id: 'sports', label: 'Runs (Cashfree + UPI / screenshot)' },
  { id: 'trek', label: 'Treks' },
  { id: 'fest', label: 'Fests' },
  { id: 'competition', label: 'Competitions' },
  { id: 'event', label: 'Events' },
  { id: 'event_show', label: 'Event shows' },
];

/** Anyone | exactly N | at least N | between min–max */
const PEOPLE_PRESETS = [
  { id: 'anyone', label: 'Anyone (1+)', hint: 'Valid for any booking size — solo or group.' },
  { id: 'exact', label: 'Exactly N people', hint: 'e.g. only when booking exactly 2 people.' },
  { id: 'at_least', label: 'At least N people', hint: 'e.g. only groups of 2 or more.' },
  { id: 'range', label: 'Between min & max', hint: 'Custom range, e.g. 2–4 people.' },
];

const EMPTY_FORM = {
  code: '',
  description: '',
  discountPercent: 10,
  maxDiscountAmount: 500,
  maxTotalUses: 0,
  maxUsesPerUser: 1,
  active: true,
  applicableEntityTypes: ['sports'],
  startsAt: '',
  expiresAt: '',
  peoplePreset: 'anyone',
  minPeople: 1,
  maxPeople: 0,
  exactPeople: 2,
};

/** Show stored UTC instants in IST inside datetime-local fields. */
function toIstDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

function statusBadge(coupon) {
  if (!coupon.active) return { label: 'Disabled', className: 'bg-gray-700 text-gray-300' };
  if (coupon.isExpired) return { label: 'Expired', className: 'bg-red-900/50 text-red-300' };
  if (coupon.isNotStarted) return { label: 'Scheduled', className: 'bg-amber-900/40 text-amber-200' };
  return { label: 'Live', className: 'bg-green-900/40 text-green-300' };
}

function detectPeoplePreset(minPeople, maxPeople) {
  const min = Math.max(1, Number(minPeople) || 1);
  const max = Math.max(0, Number(maxPeople) || 0);
  if (min <= 1 && max <= 0) return 'anyone';
  if (max > 0 && max === min) return 'exact';
  if (max <= 0 && min > 1) return 'at_least';
  return 'range';
}

function buildPeoplePayload(form) {
  if (form.peoplePreset === 'anyone') return { minPeople: 1, maxPeople: 0 };
  if (form.peoplePreset === 'exact') {
    const n = Math.min(50, Math.max(1, Number(form.exactPeople) || 1));
    return { minPeople: n, maxPeople: n };
  }
  if (form.peoplePreset === 'at_least') {
    return { minPeople: Math.min(50, Math.max(1, Number(form.minPeople) || 1)), maxPeople: 0 };
  }
  return {
    minPeople: Math.min(50, Math.max(1, Number(form.minPeople) || 1)),
    maxPeople: Math.min(50, Math.max(0, Number(form.maxPeople) || 0)),
  };
}

function peopleRuleSummary(form) {
  const { minPeople, maxPeople } = buildPeoplePayload(form);
  if (minPeople <= 1 && maxPeople <= 0) return 'Anyone can apply (1 or more people).';
  if (maxPeople > 0 && maxPeople === minPeople) {
    return `Only valid when booking exactly ${minPeople} ${minPeople === 1 ? 'person' : 'people'}.`;
  }
  if (maxPeople <= 0) return `Only valid when booking at least ${minPeople} people.`;
  return `Only valid for bookings of ${minPeople}–${maxPeople} people.`;
}

function FieldHint({ children }) {
  return (
    <p className="mt-1 text-xs text-gray-500 flex gap-1.5 items-start">
      <Info size={12} className="mt-0.5 shrink-0 text-gray-600" />
      <span>{children}</span>
    </p>
  );
}

function inputClass() {
  return 'w-full bg-[#1D1E20] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#0ECCEE]/50';
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');
  const [exampleAmount, setExampleAmount] = useState(2000);

  const loadCoupons = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminFetchJSON('/admin/coupons');
      setCoupons(data.coupons || []);
    } catch (err) {
      setError(err.message || 'Failed to load coupons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  const discountPreview = useMemo(() => {
    const base = Math.max(0, Number(exampleAmount) || 0);
    const percent = Math.max(0, Math.min(100, Number(form.discountPercent) || 0));
    const raw = Math.round((base * percent) / 100);
    const cap = Math.max(0, Number(form.maxDiscountAmount) || 0);
    const discount = Math.min(raw, cap > 0 ? cap : raw);
    return { base, percent, raw, discount, final: Math.max(0, base - discount), capped: cap > 0 && raw > cap };
  }, [exampleAmount, form.discountPercent, form.maxDiscountAmount]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const people = buildPeoplePayload(form);
    if (people.maxPeople > 0 && people.maxPeople < people.minPeople) {
      setError('Max people cannot be less than min people.');
      return;
    }
    const body = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      discountPercent: Number(form.discountPercent),
      maxDiscountAmount: Number(form.maxDiscountAmount),
      maxTotalUses: Number(form.maxTotalUses) || 0,
      maxUsesPerUser: Number(form.maxUsesPerUser) || 1,
      active: Boolean(form.active),
      applicableEntityTypes: form.applicableEntityTypes,
      startsAt: form.startsAt || null,
      expiresAt: form.expiresAt || null,
      minPeople: people.minPeople,
      maxPeople: people.maxPeople,
    };
    try {
      if (editingId) {
        await adminFetchJSON(`/admin/coupons/${editingId}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await adminFetchJSON('/admin/coupons', { method: 'POST', body: JSON.stringify(body) });
      }
      setForm(EMPTY_FORM);
      setEditingId('');
      await loadCoupons();
    } catch (err) {
      setError(err.message || 'Failed to save coupon');
    }
  };

  const startEdit = (coupon) => {
    const minPeople = Math.max(1, Number(coupon.minPeople) || 1);
    const maxPeople = Math.max(0, Number(coupon.maxPeople) || 0);
    const peoplePreset = detectPeoplePreset(minPeople, maxPeople);
    setEditingId(coupon._id);
    setForm({
      ...EMPTY_FORM,
      code: coupon.code || '',
      description: coupon.description || '',
      discountPercent: Number(coupon.discountPercent) || 10,
      maxDiscountAmount: Number(coupon.maxDiscountAmount) || 0,
      maxTotalUses: Number(coupon.maxTotalUses) || 0,
      maxUsesPerUser: Number(coupon.maxUsesPerUser) || 1,
      active: coupon.active !== false,
      applicableEntityTypes: Array.isArray(coupon.applicableEntityTypes) ? coupon.applicableEntityTypes : [],
      startsAt: toIstDatetimeLocal(coupon.startsAt),
      expiresAt: toIstDatetimeLocal(coupon.expiresAt),
      peoplePreset,
      minPeople,
      maxPeople: maxPeople || minPeople,
      exactPeople: peoplePreset === 'exact' ? minPeople : 2,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Coupon Management</h1>
        <p className="text-gray-400 max-w-2xl">
          Create percentage discounts with clear rules for party size. Coupons work on Cashfree checkout and on run bookings paid via UPI + screenshot.
        </p>
      </div>

      <div className="bg-[#111213] rounded-xl p-6 border border-gray-800">
        <div className="flex items-center gap-2 mb-5 text-white font-semibold">
          <Plus size={16} className="text-[#0ECCEE]" />
          {editingId ? 'Edit coupon' : 'Create coupon'}
        </div>

        <form onSubmit={onSubmit} className="space-y-8">
          {/* Basics */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">Basics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Coupon code</label>
                <input
                  className={inputClass()}
                  placeholder="e.g. PAIR10"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  required
                />
                <FieldHint>Users type this code at checkout / on the booking page.</FieldHint>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Description (admin only)</label>
                <input
                  className={inputClass()}
                  placeholder="e.g. 10% off for duo bookings"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>
          </section>

          {/* Discount % */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide flex items-center gap-2">
              <Percent size={14} className="text-[#0ECCEE]" /> Discount (percent of money)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Discount percent (%)</label>
                <input
                  type="number"
                  className={inputClass()}
                  value={form.discountPercent}
                  onChange={(e) => setForm((f) => ({ ...f, discountPercent: Number(e.target.value) }))}
                  min={1}
                  max={100}
                  required
                />
                <FieldHint>
                  e.g. <span className="text-gray-400">10</span> means save 10% of the payable amount (run fee × people, or checkout total depending on payment mode).
                </FieldHint>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Max discount cap (₹)</label>
                <input
                  type="number"
                  className={inputClass()}
                  value={form.maxDiscountAmount}
                  onChange={(e) => setForm((f) => ({ ...f, maxDiscountAmount: Number(e.target.value) }))}
                  min={0}
                  required
                />
                <FieldHint>
                  Caps how much ₹ can be saved. Use <span className="text-gray-400">0</span> for no cap (full percent applies). Example: 10% of ₹2000 = ₹200, but cap ₹100 → user only saves ₹100.
                </FieldHint>
              </div>
            </div>

            <div className="rounded-lg border border-gray-800 bg-[#0c0d0e] p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                <span>Live example — amount before discount:</span>
                <input
                  type="number"
                  className="w-28 bg-[#1D1E20] border border-gray-700 rounded px-2 py-1 text-white text-sm"
                  value={exampleAmount}
                  onChange={(e) => setExampleAmount(Number(e.target.value))}
                  min={0}
                />
              </div>
              <p className="text-sm text-gray-300">
                {discountPreview.percent}% of ₹{discountPreview.base.toLocaleString('en-IN')} = ₹{discountPreview.raw.toLocaleString('en-IN')}
                {discountPreview.capped ? (
                  <> → capped to <span className="text-[#0ECCEE]">₹{discountPreview.discount.toLocaleString('en-IN')}</span></>
                ) : (
                  <> → save <span className="text-[#0ECCEE]">₹{discountPreview.discount.toLocaleString('en-IN')}</span></>
                )}
                {' '}→ pay <span className="text-white font-medium">₹{discountPreview.final.toLocaleString('en-IN')}</span>
              </p>
            </div>
          </section>

          {/* People rules */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide flex items-center gap-2">
              <Users size={14} className="text-[#0ECCEE]" /> Who can use it (people count)
            </h2>
            <p className="text-xs text-gray-500">
              Checked against how many people the user selects on the booking page (runs with 1–N participants). Solo = 1 person.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PEOPLE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setForm((f) => ({
                    ...f,
                    peoplePreset: preset.id,
                    ...(preset.id === 'anyone' ? { minPeople: 1, maxPeople: 0 } : {}),
                    ...(preset.id === 'exact' ? { exactPeople: f.exactPeople || 2 } : {}),
                    ...(preset.id === 'at_least' ? { minPeople: Math.max(2, f.minPeople || 2), maxPeople: 0 } : {}),
                    ...(preset.id === 'range' ? { minPeople: Math.max(1, f.minPeople || 2), maxPeople: Math.max(f.maxPeople || 4, f.minPeople || 2) } : {}),
                  }))}
                  className={`text-left rounded-lg border px-3 py-2.5 transition ${
                    form.peoplePreset === preset.id
                      ? 'border-[#0ECCEE]/50 bg-[#0ECCEE]/10'
                      : 'border-gray-700 bg-[#1D1E20] hover:border-gray-600'
                  }`}
                >
                  <p className="text-sm font-medium text-white">{preset.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{preset.hint}</p>
                </button>
              ))}
            </div>

            {form.peoplePreset === 'exact' && (
              <div className="max-w-xs">
                <label className="block text-xs text-gray-400 mb-1">Exact number of people</label>
                <input
                  type="number"
                  className={inputClass()}
                  value={form.exactPeople}
                  onChange={(e) => setForm((f) => ({ ...f, exactPeople: Number(e.target.value) }))}
                  min={1}
                  max={50}
                />
                <FieldHint>Selecting 2 → only duo bookings can apply this coupon. Solo (1) will be rejected.</FieldHint>
              </div>
            )}
            {form.peoplePreset === 'at_least' && (
              <div className="max-w-xs">
                <label className="block text-xs text-gray-400 mb-1">Minimum people</label>
                <input
                  type="number"
                  className={inputClass()}
                  value={form.minPeople}
                  onChange={(e) => setForm((f) => ({ ...f, minPeople: Number(e.target.value) }))}
                  min={1}
                  max={50}
                />
              </div>
            )}
            {form.peoplePreset === 'range' && (
              <div className="grid grid-cols-2 gap-3 max-w-md">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Min people</label>
                  <input
                    type="number"
                    className={inputClass()}
                    value={form.minPeople}
                    onChange={(e) => setForm((f) => ({ ...f, minPeople: Number(e.target.value) }))}
                    min={1}
                    max={50}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Max people</label>
                  <input
                    type="number"
                    className={inputClass()}
                    value={form.maxPeople}
                    onChange={(e) => setForm((f) => ({ ...f, maxPeople: Number(e.target.value) }))}
                    min={1}
                    max={50}
                  />
                </div>
              </div>
            )}
            <p className="text-sm text-[#0ECCEE]/90">{peopleRuleSummary(form)}</p>
          </section>

          {/* Where it applies */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">Where it applies</h2>
            <FieldHint>
              Leave none selected to allow all types. For runs, select &quot;Runs&quot; — works for both online Cashfree and UPI + screenshot (organizer QR).
            </FieldHint>
            <div className="flex flex-wrap gap-2">
              {ENTITY_OPTIONS.map((opt) => {
                const on = form.applicableEntityTypes.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setForm((f) => ({
                      ...f,
                      applicableEntityTypes: on
                        ? f.applicableEntityTypes.filter((x) => x !== opt.id)
                        : [...f.applicableEntityTypes, opt.id],
                    }))}
                    className={`px-3 py-1.5 rounded-lg text-xs border ${
                      on
                        ? 'bg-[#0ECCEE]/20 text-[#0ECCEE] border-[#0ECCEE]/40'
                        : 'bg-[#1D1E20] text-gray-400 border-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Limits & schedule */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">Limits & schedule</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Total uses (0 = unlimited)</label>
                <input
                  type="number"
                  className={inputClass()}
                  value={form.maxTotalUses}
                  onChange={(e) => setForm((f) => ({ ...f, maxTotalUses: Number(e.target.value) }))}
                  min={0}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Uses per user</label>
                <input
                  type="number"
                  className={inputClass()}
                  value={form.maxUsesPerUser}
                  onChange={(e) => setForm((f) => ({ ...f, maxUsesPerUser: Number(e.target.value) }))}
                  min={1}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Starts at (IST, optional)</label>
                <input
                  type="datetime-local"
                  className={inputClass()}
                  value={form.startsAt}
                  onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                />
                <FieldHint>Leave empty to start immediately. Times are India (IST).</FieldHint>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Expires at (IST, optional)</label>
                <input
                  type="datetime-local"
                  className={inputClass()}
                  value={form.expiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                />
                <FieldHint>
                  Coupon stops working after this time. Midnight means end of that day. Leave empty for no expiry.
                </FieldHint>
              </div>
            </div>
            {form.expiresAt && new Date(`${form.expiresAt}:00+05:30`).getTime() < Date.now() ? (
              <p className="text-xs text-red-400">
                This expiry is already in the past — users will see &quot;This coupon has expired&quot; until you extend it.
              </p>
            ) : null}
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Active toggle (must also be within start/expiry window to be usable)
            </label>
          </section>

          <div className="flex gap-2 pt-1">
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#0ECCEE] text-black font-semibold text-sm">
              {editingId ? 'Update coupon' : 'Save coupon'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => { setForm(EMPTY_FORM); setEditingId(''); }}
                className="px-4 py-2 rounded-lg border border-gray-700 text-sm"
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      </div>

      <div className="bg-[#111213] rounded-xl p-6 border border-gray-800">
        <div className="text-white font-semibold mb-4 flex items-center gap-2">
          <Tag size={16} className="text-[#0ECCEE]" /> Coupons
        </div>
        {loading ? (
          <p className="text-gray-400 text-sm">Loading coupons...</p>
        ) : coupons.length === 0 ? (
          <p className="text-gray-500 text-sm">No coupons yet. Create one above.</p>
        ) : (
          <div className="space-y-2">
            {coupons.map((coupon) => {
              const badge = statusBadge(coupon);
              return (
              <button
                key={coupon._id}
                type="button"
                onClick={() => startEdit(coupon)}
                className={`w-full text-left bg-[#1D1E20] border rounded-lg p-3 hover:border-[#0ECCEE]/40 transition ${
                  coupon.isExpired ? 'border-red-900/50' : 'border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-white">{coupon.code}</p>
                  <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>
                {coupon.description ? <p className="text-xs text-gray-400 mt-1">{coupon.description}</p> : null}
                <p className="text-xs text-gray-400 mt-1">
                  {coupon.discountPercent}% off
                  {Number(coupon.maxDiscountAmount) > 0
                    ? ` (max ₹${coupon.maxDiscountAmount})`
                    : ' (no ₹ cap)'}
                  {' · '}
                  {coupon.peopleRuleLabel || 'Anyone (1+ people)'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Used: {coupon.usedCount || 0}
                  {' · '}
                  Remaining: {coupon.remainingUses === null ? 'Unlimited' : coupon.remainingUses}
                  {(coupon.applicableEntityTypes || []).length > 0
                    ? ` · ${coupon.applicableEntityTypes.join(', ')}`
                    : ' · All types'}
                </p>
                {coupon.expiresAt ? (
                  <p className={`text-xs mt-1 ${coupon.isExpired ? 'text-red-400' : 'text-gray-500'}`}>
                    Expires {toIstDatetimeLocal(coupon.expiresAt).replace('T', ' ')} IST
                    {coupon.isExpired ? ' — extend expiry to use again' : ''}
                  </p>
                ) : null}
              </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
