import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { adminFetchJSON } from '../../utils/adminApi';
import FeaturedEntityPicker, { buildFeaturedEntityOptions } from './FeaturedEntityPicker';

export default function HomeFeaturedSlotsEditor({
    fests = [],
    eventShows = [],
    treks = [],
    communities = [],
    sports = [],
    runClubs = [],
}) {
    const [slots, setSlots] = useState({ heroBanner: null, featuredExperience: null });
    const [initial, setInitial] = useState({ heroBanner: null, featuredExperience: null });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const data = await adminFetchJSON('/admin/site-settings/home-featured-slots');
                if (!active) return;
                const s = data?.slots || {};
                setSlots(s);
                setInitial(s);
            } catch (_) {
                if (active) setError('Could not load home featured picks');
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, []);

    const heroGroups = useMemo(
        () => buildFeaturedEntityOptions({ fests, eventShows, allowedTypes: ['fest', 'events'] }),
        [fests, eventShows],
    );

    const featuredGroups = useMemo(
        () => buildFeaturedEntityOptions({ fests, eventShows, treks, communities, sports, runClubs }),
        [fests, eventShows, treks, communities, sports, runClubs],
    );

    const dirty = JSON.stringify(slots) !== JSON.stringify(initial);

    const notifySite = useCallback(() => {
        localStorage.setItem('admin_data_updated', Date.now().toString());
        setTimeout(() => localStorage.removeItem('admin_data_updated'), 1000);
    }, []);

    const save = async () => {
        setSaving(true);
        setError('');
        try {
            const data = await adminFetchJSON('/admin/site-settings/home-featured-slots', {
                method: 'PUT',
                body: JSON.stringify({ slots }),
            });
            const s = data?.slots || slots;
            setSlots(s);
            setInitial(s);
            setSaved(true);
            notifySite();
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            setError(err.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="rounded-2xl border border-white/8 bg-[#17181A] px-5 py-4">
            <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                    <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#0ECCEE] mb-1">
                        <Sparkles size={12} /> Home page
                    </div>
                    <h2 className="text-sm font-bold text-white">Hero Banner &amp; Featured Experience</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Pick one item for the home hero banner and one lead card for Ongoing Events. Selecting a new hero removes the previous slide.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={save}
                    disabled={saving || loading || !dirty}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0ECCEE] hover:bg-[#3dd8f5] rounded-xl text-xs font-bold text-black transition-colors disabled:opacity-40"
                >
                    {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} /> : null}
                    {saving ? 'Saving' : saved ? 'Saved' : 'Save'}
                </button>
            </div>

            {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

            <div className="grid sm:grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Hero banner (one fest or event)</label>
                    <FeaturedEntityPicker
                        value={slots.heroBanner}
                        onChange={(heroBanner) => { setSlots((p) => ({ ...p, heroBanner })); setSaved(false); }}
                        groups={heroGroups}
                        placeholder="— No hero slide —"
                        disabled={loading}
                    />
                </div>
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Featured experience (Ongoing Events lead)</label>
                    <FeaturedEntityPicker
                        value={slots.featuredExperience}
                        onChange={(featuredExperience) => { setSlots((p) => ({ ...p, featuredExperience })); setSaved(false); }}
                        groups={featuredGroups}
                        placeholder="— Auto from section —"
                        disabled={loading}
                    />
                </div>
            </div>
        </div>
    );
}
