import { useEffect, useMemo, useState } from 'react';
import { Loader, X } from 'lucide-react';
import {
    fetchEventOrganizerEvent,
    createEventOrganizerManualParticipant,
} from '../../services/api/eventShowOrganizer.api';
import { getEventShowTiers, sanitizeEventShowAddOns, formatInr, resolveTierParticipantCount } from '../../utils/eventShowTiers';

const BLOOD_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Prefer not to say'];
const DRIVE_OPTIONS = [
    'Drive only (Free)',
    'Drive + Trackday',
    'Trackday only',
    'Spectators (Free)',
];
const DRIVE_FIELD_NAMES = new Set(['join_drive', 'join_independence_day_drive', 'independence_day_drive']);

function collectFormFields(registration = {}) {
    if (registration.formType === 'MULTI_STEP' && Array.isArray(registration.steps)) {
        return registration.steps.flatMap((step) => (Array.isArray(step.fields) ? step.fields : []));
    }
    if (Array.isArray(registration.formSchema)) return registration.formSchema;
    return [];
}

function isDriveOnlyTier(tier) {
    if (!tier) return false;
    if (String(tier.id || '') === 'tier_drive_only') return true;
    return /drive only|no trackday/i.test(`${tier.name || ''} ${tier.description || ''}`);
}

function isSpectatorTier(tier) {
    if (!tier) return false;
    if (String(tier.id || '') === 'tier_spectator') return true;
    return /\bspectator/i.test(`${tier.name || ''} ${tier.description || ''}`);
}

function defaultResponses(fields) {
    const next = {};
    fields.forEach((f) => {
        if (f?.fieldName) next[f.fieldName] = '';
    });
    if (!next.name) next.name = '';
    if (!next.email) next.email = '';
    if (!next.phone) next.phone = '';
    return next;
}

export default function EventOrganizerManualAddModal({ eventId, open, onClose, onCreated }) {
    const [loadingEvent, setLoadingEvent] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [event, setEvent] = useState(null);
    const [responses, setResponses] = useState({});
    const [tierId, setTierId] = useState('');
    const [selectedAddOnIds, setSelectedAddOnIds] = useState([]);
    const [paymentStatus, setPaymentStatus] = useState('paid');
    const [note, setNote] = useState('');

    useEffect(() => {
        if (!open || !eventId) return undefined;
        let cancelled = false;
        (async () => {
            setLoadingEvent(true);
            setError('');
            try {
                const data = await fetchEventOrganizerEvent(eventId);
                if (cancelled) return;
                const ev = data.event || null;
                setEvent(ev);
                const fields = collectFormFields(ev?.registration || {});
                setResponses(defaultResponses(fields));
                setTierId('');
                setSelectedAddOnIds([]);
                setPaymentStatus('paid');
                setNote('');
            } catch (err) {
                if (!cancelled) setError(err.message || 'Failed to load event form');
            } finally {
                if (!cancelled) setLoadingEvent(false);
            }
        })();
        return () => { cancelled = true; };
    }, [open, eventId]);

    const fields = useMemo(() => collectFormFields(event?.registration || {}), [event]);
    const packages = useMemo(() => {
        if (!event) return [];
        return getEventShowTiers({ ...event, pricingMode: event.pricingMode === 'tiers' || (event.tiers || []).length ? 'tiers' : event.pricingMode });
    }, [event]);
    const addOns = useMemo(() => sanitizeEventShowAddOns(event?.addOns), [event]);

    const joinDrive = String(responses.join_drive || responses.join_independence_day_drive || '').trim();
    const driveOnly = /drive only/i.test(joinDrive) || (/^yes/i.test(joinDrive) && /free/i.test(joinDrive) && !/trackday/i.test(joinDrive));
    const spectator = /spectator/i.test(joinDrive);
    const needsTrackdayPackage = Boolean(joinDrive) && !driveOnly && !spectator;

    const visiblePackages = useMemo(() => {
        if (!packages.length) return [];
        if (driveOnly) return packages.filter(isDriveOnlyTier);
        if (spectator) return packages.filter(isSpectatorTier);
        return packages.filter((t) => !isDriveOnlyTier(t) && !isSpectatorTier(t));
    }, [packages, driveOnly, spectator]);

    const selectedTier = packages.find((t) => t.id === tierId) || null;
    const packageFee = Math.max(0, Number(selectedTier?.fee) || 0);
    const addOnTotal = spectator
        ? 0
        : addOns.filter((a) => selectedAddOnIds.includes(a.id)).reduce((sum, a) => sum + a.fee, 0);
    const total = packageFee + addOnTotal;

    useEffect(() => {
        if (!open) return;
        if (driveOnly) {
            const drive = packages.find(isDriveOnlyTier);
            if (drive && tierId !== drive.id) setTierId(drive.id);
            setSelectedAddOnIds((ids) => (ids.length ? [] : ids));
            setPaymentStatus((s) => (s === 'free' ? s : 'free'));
            return;
        }
        if (spectator) {
            const spec = packages.find(isSpectatorTier);
            if (spec && tierId !== spec.id) setTierId(spec.id);
            setSelectedAddOnIds((ids) => (ids.length ? [] : ids));
            setPaymentStatus((s) => (s === 'free' ? s : 'free'));
            return;
        }
        if (needsTrackdayPackage && selectedTier && (isDriveOnlyTier(selectedTier) || isSpectatorTier(selectedTier))) {
            setTierId('');
        }
        if (total > 0 && paymentStatus === 'free') setPaymentStatus('paid');
    }, [open, driveOnly, spectator, needsTrackdayPackage, packages, tierId, selectedTier, total, paymentStatus]);

    const driverCount = Math.max(1, resolveTierParticipantCount(selectedTier));
    const isGroupPackage = driverCount > 1 && !driveOnly && !spectator;

    const detailFields = useMemo(() => {
        const base = (fields.length ? fields : [
            { fieldName: 'name', label: 'Full Name', type: 'text', required: true },
            { fieldName: 'email', label: 'Email', type: 'email', required: true },
            { fieldName: 'phone', label: 'Phone', type: 'tel', required: true },
            { fieldName: 'blood_group', label: 'Blood Group', type: 'select', required: false, options: BLOOD_OPTIONS },
            { fieldName: 'vehicle_details', label: 'Vehicle details', type: 'text', required: false },
        ]).filter((f) => !DRIVE_FIELD_NAMES.has(String(f.fieldName || '')));
        return base;
    }, [fields]);

    const driveFields = useMemo(
        () => fields.filter((f) => DRIVE_FIELD_NAMES.has(String(f.fieldName || ''))),
        [fields],
    );

    const setField = (fieldName, value) => {
        setResponses((prev) => ({ ...prev, [fieldName]: value }));
    };

    const renderField = (field, { requiredOverride } = {}) => {
        const key = String(field.fieldName || '');
        if (!key) return null;
        const isDrive = DRIVE_FIELD_NAMES.has(key);
        const label = isDrive ? 'What are they joining?' : (field.label || key);
        const options = isDrive
            ? DRIVE_OPTIONS
            : (Array.isArray(field.options) && field.options.length
                ? field.options
                : (key === 'blood_group' ? BLOOD_OPTIONS : []));
        const type = String(field.type || 'text').toLowerCase();
        const required = requiredOverride != null ? requiredOverride : (Boolean(field.required) || isDrive);

        if (isDrive || type === 'radio' || type === 'select' || options.length) {
            return (
                <label key={key} className="block space-y-1.5">
                    <span className="text-xs font-medium text-gray-400">
                        {label}
                        {required ? ' *' : ''}
                    </span>
                    <select
                        value={responses[key] || ''}
                        onChange={(e) => setField(key, e.target.value)}
                        required={required}
                        className="w-full rounded-xl bg-[#111213] border border-gray-800 px-3 py-2.5 text-sm focus:outline-none focus:border-[#0ECCEE]/50"
                    >
                        <option value="">Select…</option>
                        {options.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                </label>
            );
        }

        return (
            <label key={key} className="block space-y-1.5">
                <span className="text-xs font-medium text-gray-400">
                    {label}
                    {required ? ' *' : ''}
                </span>
                <input
                    type={type === 'email' ? 'email' : type === 'tel' ? 'tel' : 'text'}
                    value={responses[key] || ''}
                    onChange={(e) => setField(key, e.target.value)}
                    required={required}
                    placeholder={field.placeholder || ''}
                    className="w-full rounded-xl bg-[#111213] border border-gray-800 px-3 py-2.5 text-sm focus:outline-none focus:border-[#0ECCEE]/50"
                />
            </label>
        );
    };

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        const name = String(responses.name || responses.full_name || responses.leader_name || '').trim();
        const email = String(responses.email || '').trim();
        const phone = String(responses.phone || responses.mobile || responses.contact_no || '').trim();
        if (!name) {
            setError('Full name is required');
            return;
        }
        if (!email && !phone) {
            setError('Email or phone is required');
            return;
        }
        if (fields.some((f) => DRIVE_FIELD_NAMES.has(String(f.fieldName || ''))) && !joinDrive) {
            setError('Choose what they are joining');
            return;
        }
        if (packages.length && !tierId) {
            setError(needsTrackdayPackage ? 'Select a Trackday package' : 'Select a package');
            return;
        }

        setSaving(true);
        try {
            await createEventOrganizerManualParticipant(eventId, {
                responses,
                tierId: tierId || undefined,
                selectedAddOnIds: spectator ? [] : selectedAddOnIds,
                paymentStatus: total > 0 ? paymentStatus : 'free',
                status: 'approved',
                note: note.trim() || undefined,
            });
            onCreated?.();
            onClose?.();
        } catch (err) {
            setError(err.message || 'Could not add guest');
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <button type="button" aria-label="Close" className="absolute inset-0 bg-black/60" onClick={onClose} />
            <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-gray-800 bg-[#161718] shadow-2xl">
                <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-800 bg-[#161718] px-4 py-3">
                    <div>
                        <h2 className="text-base font-bold text-white">Add guest manually</h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Same fields as the public registration form
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {loadingEvent ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader className="animate-spin text-[#0ECCEE]" size={22} />
                    </div>
                ) : (
                    <form onSubmit={submit} className="p-4 space-y-4">
                        {error ? (
                            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                                {error}
                            </div>
                        ) : null}

                        {(driveFields.length
                            ? driveFields
                            : [{ fieldName: 'join_drive', label: 'What are they joining?', type: 'select', required: true, options: DRIVE_OPTIONS }]
                        ).map((field) => renderField(field))}

                        {packages.length > 0 && (
                            <label className="block space-y-1.5">
                                <span className="text-xs font-medium text-gray-400">
                                    {needsTrackdayPackage ? 'Trackday package *' : 'Package *'}
                                </span>
                                <select
                                    value={tierId}
                                    onChange={(e) => setTierId(e.target.value)}
                                    required
                                    disabled={driveOnly || spectator}
                                    className="w-full rounded-xl bg-[#111213] border border-gray-800 px-3 py-2.5 text-sm focus:outline-none focus:border-[#0ECCEE]/50 disabled:opacity-60"
                                >
                                    <option value="">Select package…</option>
                                    {(visiblePackages.length ? visiblePackages : packages).map((tier) => (
                                        <option key={tier.id} value={tier.id}>
                                            {tier.name} · {Number(tier.fee) > 0 ? formatInr(tier.fee) : 'Free'}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}

                        {isGroupPackage ? (
                            <div className="space-y-4">
                                {Array.from({ length: driverCount }, (_, idx) => {
                                    const i = idx + 1;
                                    const isFirst = i === 1;
                                    return (
                                        <div key={`driver_${i}`} className="rounded-xl border border-gray-800 bg-[#111213] p-3 space-y-3">
                                            <p className="text-xs font-semibold text-gray-300">
                                                Driver {i}{isFirst ? ' (registering)' : ''}
                                            </p>
                                            {renderField({
                                                fieldName: isFirst ? 'name' : `driver_${i}_name`,
                                                label: 'Full Name',
                                                type: 'text',
                                                required: true,
                                            })}
                                            {renderField({
                                                fieldName: isFirst ? 'email' : `driver_${i}_email`,
                                                label: 'Email',
                                                type: 'email',
                                                required: true,
                                            })}
                                            {renderField({
                                                fieldName: isFirst ? 'phone' : `driver_${i}_phone`,
                                                label: 'Phone',
                                                type: 'tel',
                                                required: true,
                                            })}
                                            {renderField({
                                                fieldName: isFirst ? 'blood_group' : `driver_${i}_blood_group`,
                                                label: 'Blood Group',
                                                type: 'select',
                                                required: true,
                                                options: BLOOD_OPTIONS,
                                            })}
                                        </div>
                                    );
                                })}
                                {detailFields
                                    .filter((f) => {
                                        const k = String(f.fieldName || '').toLowerCase();
                                        return !['name', 'full_name', 'leader_name', 'email', 'phone', 'mobile', 'contact_no', 'blood_group'].includes(k);
                                    })
                                    .map((field) => renderField(field))}
                            </div>
                        ) : (
                            detailFields.map((field) => renderField(field, {
                                requiredOverride: (driveOnly || spectator) && String(field.fieldName) === 'blood_group'
                                    ? false
                                    : undefined,
                            }))
                        )}

                        {addOns.length > 0 && !spectator && (
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-gray-400">Add-ons (optional)</p>
                                {addOns.map((addOn) => {
                                    const checked = selectedAddOnIds.includes(addOn.id);
                                    return (
                                        <label
                                            key={addOn.id}
                                            className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer ${
                                                checked
                                                    ? 'border-[#0ECCEE]/50 bg-[#0ECCEE]/10'
                                                    : 'border-gray-800 bg-[#111213]'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => {
                                                    setSelectedAddOnIds((ids) => (
                                                        checked
                                                            ? ids.filter((id) => id !== addOn.id)
                                                            : [...ids, addOn.id]
                                                    ));
                                                }}
                                                className="mt-1"
                                            />
                                            <span className="min-w-0 flex-1">
                                                <span className="flex justify-between gap-2 text-sm font-semibold text-white">
                                                    <span>{addOn.name}</span>
                                                    <span className="text-[#0ECCEE]">+{formatInr(addOn.fee)}</span>
                                                </span>
                                                {addOn.vehicles ? (
                                                    <span className="block text-[11px] text-amber-300 mt-0.5">
                                                        Cars: {addOn.vehicles}
                                                    </span>
                                                ) : null}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}

                        {total > 0 ? (
                            <label className="block space-y-1.5">
                                <span className="text-xs font-medium text-gray-400">Payment status</span>
                                <select
                                    value={paymentStatus}
                                    onChange={(e) => setPaymentStatus(e.target.value)}
                                    className="w-full rounded-xl bg-[#111213] border border-gray-800 px-3 py-2.5 text-sm focus:outline-none focus:border-[#0ECCEE]/50"
                                >
                                    <option value="paid">Paid (cash / UPI collected)</option>
                                    <option value="pending">Pending</option>
                                </select>
                            </label>
                        ) : null}

                        <label className="block space-y-1.5">
                            <span className="text-xs font-medium text-gray-400">Organizer note (optional)</span>
                            <input
                                type="text"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="e.g. Walk-in at Irani Cafe"
                                className="w-full rounded-xl bg-[#111213] border border-gray-800 px-3 py-2.5 text-sm focus:outline-none focus:border-[#0ECCEE]/50"
                            />
                        </label>

                        <div className="rounded-xl border border-gray-800 bg-[#111213] px-3 py-2.5 flex items-center justify-between text-sm">
                            <span className="text-gray-400">Total</span>
                            <span className="font-bold text-white">{total > 0 ? formatInr(total) : 'Free'}</span>
                        </div>

                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full h-12 rounded-xl bg-[#0ECCEE] text-black font-bold text-sm disabled:opacity-60 inline-flex items-center justify-center gap-2"
                        >
                            {saving ? <Loader className="animate-spin" size={16} /> : null}
                            {saving ? 'Saving…' : 'Add guest'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
