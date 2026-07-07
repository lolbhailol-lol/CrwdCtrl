import { useEffect, useState } from 'react';
import { Tag, Plus } from 'lucide-react';
import { adminFetchJSON } from '../../utils/adminApi';

const ENTITY_TYPES = ['trek', 'fest', 'competition', 'event', 'event_show', 'sports'];

const EMPTY_FORM = {
  code: '',
  description: '',
  discountPercent: 10,
  maxDiscountAmount: 500,
  maxTotalUses: 0,
  maxUsesPerUser: 1,
  active: true,
  applicableEntityTypes: [],
  startsAt: '',
  expiresAt: '',
};

export default function CouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');

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

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const body = {
      ...form,
      code: form.code.trim().toUpperCase(),
      startsAt: form.startsAt || null,
      expiresAt: form.expiresAt || null,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Coupon Management</h1>
        <p className="text-gray-400">Create and manage discounts for all paid registrations</p>
      </div>

      <div className="bg-[#111213] rounded-xl p-6 border border-gray-800">
        <div className="flex items-center gap-2 mb-4 text-white font-semibold">
          <Plus size={16} className="text-[#0ECCEE]" />
          {editingId ? 'Edit Coupon' : 'Create Coupon'}
        </div>
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="bg-[#1D1E20] border border-gray-700 rounded-lg px-3 py-2" placeholder="Code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} required />
          <input className="bg-[#1D1E20] border border-gray-700 rounded-lg px-3 py-2" placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <input type="number" className="bg-[#1D1E20] border border-gray-700 rounded-lg px-3 py-2" placeholder="Discount %" value={form.discountPercent} onChange={(e) => setForm((f) => ({ ...f, discountPercent: Number(e.target.value) }))} min={1} max={100} required />
          <input type="number" className="bg-[#1D1E20] border border-gray-700 rounded-lg px-3 py-2" placeholder="Max discount amount" value={form.maxDiscountAmount} onChange={(e) => setForm((f) => ({ ...f, maxDiscountAmount: Number(e.target.value) }))} min={0} required />
          <input type="number" className="bg-[#1D1E20] border border-gray-700 rounded-lg px-3 py-2" placeholder="Total usage limit (0 unlimited)" value={form.maxTotalUses} onChange={(e) => setForm((f) => ({ ...f, maxTotalUses: Number(e.target.value) }))} min={0} />
          <input type="number" className="bg-[#1D1E20] border border-gray-700 rounded-lg px-3 py-2" placeholder="Per-user limit" value={form.maxUsesPerUser} onChange={(e) => setForm((f) => ({ ...f, maxUsesPerUser: Number(e.target.value) }))} min={1} />
          <input type="datetime-local" className="bg-[#1D1E20] border border-gray-700 rounded-lg px-3 py-2" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} />
          <input type="datetime-local" className="bg-[#1D1E20] border border-gray-700 rounded-lg px-3 py-2" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} />
          <label className="md:col-span-2 text-sm text-gray-300">Applicable entity types</label>
          <div className="md:col-span-2 flex flex-wrap gap-2">
            {ENTITY_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setForm((f) => ({
                  ...f,
                  applicableEntityTypes: f.applicableEntityTypes.includes(type)
                    ? f.applicableEntityTypes.filter((x) => x !== type)
                    : [...f.applicableEntityTypes, type],
                }))}
                className={`px-2.5 py-1 rounded-full text-xs border ${form.applicableEntityTypes.includes(type) ? 'bg-[#0ECCEE]/20 text-[#0ECCEE] border-[#0ECCEE]/40' : 'bg-[#1D1E20] text-gray-400 border-gray-700'}`}
              >
                {type}
              </button>
            ))}
          </div>
          <label className="md:col-span-2 text-sm flex items-center gap-2 text-gray-300">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
            Active
          </label>
          <div className="md:col-span-2 flex gap-2">
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#0ECCEE] text-black font-semibold">Save Coupon</button>
            {editingId && <button type="button" onClick={() => { setForm(EMPTY_FORM); setEditingId(''); }} className="px-4 py-2 rounded-lg border border-gray-700">Cancel Edit</button>}
          </div>
        </form>
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      </div>

      <div className="bg-[#111213] rounded-xl p-6 border border-gray-800">
        <div className="text-white font-semibold mb-4 flex items-center gap-2"><Tag size={16} className="text-[#0ECCEE]" /> Coupons</div>
        {loading ? <p className="text-gray-400 text-sm">Loading coupons...</p> : (
          <div className="space-y-2">
            {coupons.map((coupon) => (
              <button key={coupon._id} onClick={() => { setEditingId(coupon._id); setForm({ ...EMPTY_FORM, ...coupon, startsAt: coupon.startsAt ? new Date(coupon.startsAt).toISOString().slice(0, 16) : '', expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString().slice(0, 16) : '' }); }} className="w-full text-left bg-[#1D1E20] border border-gray-700 rounded-lg p-3 hover:border-[#0ECCEE]/40 transition">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white">{coupon.code}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${coupon.active ? 'bg-green-900/40 text-green-300' : 'bg-gray-700 text-gray-300'}`}>{coupon.active ? 'Active' : 'Disabled'}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{coupon.discountPercent}% off up to Rs {coupon.maxDiscountAmount}</p>
                <p className="text-xs text-gray-500 mt-1">Used: {coupon.usedCount || 0} | Remaining: {coupon.remainingUses === null ? 'Unlimited' : coupon.remainingUses}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
