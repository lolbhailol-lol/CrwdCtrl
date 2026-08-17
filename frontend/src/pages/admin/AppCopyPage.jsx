import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, Type } from 'lucide-react';
import { adminFetchJSON } from '../../services/api/admin.api.js';
import { notifyAdminDataUpdated } from '../../utils/notifyAdminDataUpdated';
import { DEFAULT_PUBLIC_CONFIG, mergePublicConfig } from '../../constants/publicAppConfig';
import { InlinePageLoader } from '../../components/DetailPageLoader';

function Field({ label, hint, children }) {
    return (
        <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-200">{label}</span>
            {hint ? <span className="block text-xs text-gray-500">{hint}</span> : null}
            {children}
        </label>
    );
}

const inputClass =
    'w-full rounded-lg bg-[#1E1F21] border border-white/10 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#0ECCEE]';

function LabelGroup({ title, description, values, onChange, keys }) {
    return (
        <section className="rounded-2xl border border-white/10 bg-[#111213] p-5 space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-white">{title}</h2>
                {description ? <p className="text-sm text-gray-500 mt-1">{description}</p> : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                {keys.map(({ key, label }) => (
                    <Field key={key} label={label}>
                        <input
                            className={inputClass}
                            value={values?.[key] || ''}
                            onChange={(e) => onChange(key, e.target.value)}
                        />
                    </Field>
                ))}
            </div>
        </section>
    );
}

export default function AppCopyPage() {
    const [config, setConfig] = useState(DEFAULT_PUBLIC_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await adminFetchJSON('/admin/site-settings/app-copy');
            setConfig(mergePublicConfig(data?.config));
        } catch (err) {
            setError(err.message || 'Failed to load app copy');
            setConfig(DEFAULT_PUBLIC_CONFIG);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const setLabel = (group, key, value) => {
        setConfig((prev) => ({
            ...prev,
            labels: {
                ...prev.labels,
                [group]: { ...prev.labels[group], [key]: value },
            },
        }));
    };

    const setEmpty = (group, key, value) => {
        setConfig((prev) => ({
            ...prev,
            emptyStates: {
                ...prev.emptyStates,
                [group]: { ...prev.emptyStates[group], [key]: value },
            },
        }));
    };

    const save = async () => {
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const data = await adminFetchJSON('/admin/site-settings/app-copy', {
                method: 'PUT',
                body: JSON.stringify({ config }),
            });
            setConfig(mergePublicConfig(data?.config));
            notifyAdminDataUpdated();
            setSuccess('Saved. Installed apps will show this copy on the next refresh.');
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <InlinePageLoader label="Loading app copy…" minHeight={false} className="min-h-80" />;
    }

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Type className="w-7 h-7 text-[#0ECCEE]" /> App copy
                    </h1>
                    <p className="text-gray-400 mt-2 max-w-xl">
                        Change section titles, empty-state text, and the announcement banner.
                        These update in the live app without a Play Store release.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#0ECCEE] text-black font-semibold px-4 py-2.5 disabled:opacity-60"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save changes
                </button>
            </div>

            {error && (
                <div className="rounded-xl border border-red-800 bg-red-900/20 px-4 py-3 text-red-400 text-sm">{error}</div>
            )}
            {success && (
                <div className="rounded-xl border border-emerald-800 bg-emerald-900/20 px-4 py-3 text-emerald-400 text-sm">{success}</div>
            )}

            <section className="rounded-2xl border border-white/10 bg-[#111213] p-5 space-y-4">
                <div>
                    <h2 className="text-lg font-semibold text-white">Announcement banner</h2>
                    <p className="text-sm text-gray-500 mt-1">Shows at the top of Home, Fests, Treks, Sports, and Events.</p>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-200">
                    <input
                        type="checkbox"
                        checked={config.announcement.enabled}
                        onChange={(e) => setConfig((prev) => ({
                            ...prev,
                            announcement: { ...prev.announcement, enabled: e.target.checked },
                        }))}
                    />
                    Show banner
                </label>
                <Field label="Message" hint="Keep it short. HTML is stripped.">
                    <input
                        className={inputClass}
                        maxLength={280}
                        value={config.announcement.text}
                        onChange={(e) => setConfig((prev) => ({
                            ...prev,
                            announcement: { ...prev.announcement, text: e.target.value },
                        }))}
                        placeholder="Independence Day treks are live"
                    />
                </Field>
                <Field label="Optional link" hint="App path like /treks, or https://www.crwdctrl.in/…">
                    <input
                        className={inputClass}
                        value={config.announcement.href}
                        onChange={(e) => setConfig((prev) => ({
                            ...prev,
                            announcement: { ...prev.announcement, href: e.target.value },
                        }))}
                        placeholder="/treks"
                    />
                </Field>
                <label className="flex items-center gap-2 text-sm text-gray-200">
                    <input
                        type="checkbox"
                        checked={config.announcement.dismissible !== false}
                        onChange={(e) => setConfig((prev) => ({
                            ...prev,
                            announcement: { ...prev.announcement, dismissible: e.target.checked },
                        }))}
                    />
                    Users can dismiss it
                </label>
            </section>

            <LabelGroup
                title="Home"
                description="Fixed carousels on the homepage"
                values={config.labels.home}
                onChange={(key, value) => setLabel('home', key, value)}
                keys={[
                    { key: 'ongoing', label: 'Ongoing section title' },
                    { key: 'happening', label: 'Happening near you title' },
                ]}
            />
            <LabelGroup
                title="Fests"
                values={config.labels.fests}
                onChange={(key, value) => setLabel('fests', key, value)}
                keys={[
                    { key: 'ongoing', label: 'Ongoing' },
                    { key: 'upcoming', label: 'Upcoming' },
                    { key: 'lastYearHits', label: 'Last year hits' },
                    { key: 'featured', label: 'Featured (type pages)' },
                ]}
            />
            <LabelGroup
                title="Treks"
                values={config.labels.treks}
                onChange={(key, value) => setLabel('treks', key, value)}
                keys={[
                    { key: 'communities', label: 'Communities' },
                    { key: 'weekendPlans', label: 'Weekend plans' },
                    { key: 'browseCategories', label: 'Browse categories' },
                    { key: 'beginner', label: 'Beginner friendly' },
                ]}
            />
            <LabelGroup
                title="Sports"
                values={config.labels.sports}
                onChange={(key, value) => setLabel('sports', key, value)}
                keys={[
                    { key: 'upcoming', label: 'Upcoming activities' },
                    { key: 'runClubs', label: 'Run clubs' },
                ]}
            />
            <LabelGroup
                title="Events"
                values={config.labels.events}
                onChange={(key, value) => setLabel('events', key, value)}
                keys={[
                    { key: 'spotlight', label: 'Spotlight' },
                    { key: 'upcoming', label: 'Upcoming shows' },
                    { key: 'community', label: 'Community events' },
                ]}
            />

            <LabelGroup
                title="Empty-state messages"
                description="Shown when a section has no listings"
                values={{
                    'home.happening': config.emptyStates.home.happening,
                    'fests.none': config.emptyStates.fests.none,
                    'treks.communities': config.emptyStates.treks.communities,
                    'treks.weekendPlans': config.emptyStates.treks.weekendPlans,
                    'treks.category': config.emptyStates.treks.category,
                    'treks.beginner': config.emptyStates.treks.beginner,
                    'sports.upcoming': config.emptyStates.sports.upcoming,
                    'sports.runClubs': config.emptyStates.sports.runClubs,
                    'events.spotlight': config.emptyStates.events.spotlight,
                    'events.upcoming': config.emptyStates.events.upcoming,
                    'events.community': config.emptyStates.events.community,
                }}
                onChange={(compound, value) => {
                    const [group, key] = compound.split('.');
                    setEmpty(group, key, value);
                }}
                keys={[
                    { key: 'home.happening', label: 'Home · happening' },
                    { key: 'fests.none', label: 'Fests · none' },
                    { key: 'treks.communities', label: 'Treks · communities' },
                    { key: 'treks.weekendPlans', label: 'Treks · weekend plans' },
                    { key: 'treks.category', label: 'Treks · category' },
                    { key: 'treks.beginner', label: 'Treks · beginner' },
                    { key: 'sports.upcoming', label: 'Sports · upcoming' },
                    { key: 'sports.runClubs', label: 'Sports · run clubs' },
                    { key: 'events.spotlight', label: 'Events · spotlight' },
                    { key: 'events.upcoming', label: 'Events · upcoming' },
                    { key: 'events.community', label: 'Events · community' },
                ]}
            />
        </div>
    );
}
