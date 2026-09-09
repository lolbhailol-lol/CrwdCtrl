import { useState } from 'react';
import {
    ChevronDown, Phone, Calendar, Users, MapPin,
    CheckCircle, Clock, Copy, MessageCircle, Trash2, Mail, Bell, ContactRound, Mountain,
} from 'lucide-react';
import TrekRegistrationResponses from './TrekRegistrationResponses';
import { isValidWhatsAppPhone } from '../../utils/whatsappDeepLink';

function Pill({ children, tone = 'neutral' }) {
    const styles = {
        paid: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/25',
        free: 'bg-gray-700/40 text-gray-400 border-gray-600/40',
        in: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/25',
        pending: 'bg-amber-500/20 text-amber-400 border-amber-500/25',
        repeat: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
        guest: 'bg-violet-500/15 text-violet-300 border-violet-500/25',
    };
    return (
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${styles[tone] || styles.free}`}>
            {children}
        </span>
    );
}

function initials(name = '') {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function paidAmounts(participant = {}) {
    const gross = Number(participant.grossCollected ?? participant.amountPaid ?? 0);
    const net = Number(participant.organizerNet ?? gross);
    const fee = Number(participant.gatewayFee ?? participant.platformFee ?? 0);
    return { gross, net, fee };
}

function rupee(n) {
    return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatShortDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function copyText(text, onDone) {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => onDone?.()).catch(() => {});
}

/** Drink / skill answers organizers need at a glance (TouchGrass-style forms). */
export function getGuestOpsAnswers(participant = {}) {
    const fields = Array.isArray(participant.registrationFields) ? participant.registrationFields : [];
    const formData = participant.formData && typeof participant.formData === 'object'
        ? participant.formData
        : {};
    const byKey = new Map(
        fields
            .filter((f) => f?.fieldName)
            .map((f) => [String(f.fieldName).toLowerCase(), f]),
    );
    const pickExact = (keys, labelHint) => {
        for (const key of keys) {
            const field = byKey.get(key);
            const fromField = String(field?.value || '').trim();
            if (fromField) {
                return { key, label: field.label || labelHint, value: fromField };
            }
            const fromData = String(formData[key] || '').trim();
            if (fromData) return { key, label: labelHint, value: fromData };
        }
        return null;
    };
    const pickByPattern = (keyRe, labelRe, labelHint) => {
        for (const field of fields) {
            const key = String(field.fieldName || '').toLowerCase();
            const label = String(field.label || '');
            const value = String(field.value || '').trim();
            if (!value) continue;
            if (keyRe.test(key) || labelRe.test(label)) {
                return { key, label: label || labelHint, value };
            }
        }
        for (const [key, raw] of Object.entries(formData)) {
            const value = String(raw || '').trim();
            if (!value) continue;
            if (keyRe.test(String(key).toLowerCase())) {
                return { key, label: labelHint, value };
            }
        }
        return null;
    };

    const drink = pickExact(
        [
            'post_game_fuel_at_cafe_bok',
            'post_game_fuel',
            'cafe_drink',
            'coffee',
            'drink',
            'cafe',
            'beverage',
        ],
        'Post game fuel',
    ) || pickByPattern(
        /fuel|cafe|coffee|drink|beverage|mokaroma|ritrovo/,
        /fuel|cafe|coffee|drink|mokaroma|ritrovo/i,
        'Post game fuel',
    );

    const skill = pickExact(
        ['badminton_level', 'skill_level', 'skill', 'level', 'playing_level'],
        'Skill',
    ) || pickByPattern(
        /badminton|skill|level/,
        /badminton|skill|rate yourself|playing level/i,
        'Skill',
    );

    const gender = pickExact(['gender', 'participant_gender', 'sex'], 'Gender')
        || pickByPattern(/^sex$|^gender$/, /gender/i, 'Gender');

    return { drink, skill, gender };
}

export function shortOpsLabel(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const head = raw.split(/\s*[–—]\s*/)[0].trim();
    return head.length > 28 ? `${head.slice(0, 26)}…` : head;
}

export default function ParticipantCard({
    participant,
    index,
    activityLabelSingular = 'trek',
    activityLabelPlural = 'treks',
    forceOpen = false,
    selected = false,
    onToggleSelect,
    onResend,
    onSendEmail,
    onNotify,
    onWhatsApp,
    onDelete,
    onCopied,
    onApprovePayment,
    onRejectPayment,
    onReviewPayment,
    onOpenCrm,
    extraExpandedContent = null,
    /** contact = name + phone only until expanded (event-community guests) */
    summaryMode = 'full',
}) {
    const [open, setOpen] = useState(false);
    const isOpen = forceOpen || open;
    const contactOnly = summaryMode === 'contact';
    const fields = participant.registrationFields || [];
    const checkedIn = participant.checkInStatus === 'Checked In';
    const paid = participant.paymentStatus === 'Paid';
    const pendingReview = participant.paymentStatus === 'Pending review' || participant.status === 'pending';
    const rejected = participant.paymentStatus === 'Rejected' || participant.status === 'cancelled';
    const phone = participant.phone && participant.phone !== '—' ? participant.phone : '';
    const email = participant.userEmail || participant.email || '';
    const canWhatsApp = isValidWhatsAppPhone(phone);
    const activityCount = Number(participant.trekCount) || 1;
    const isRepeat = Boolean(participant.isRepeat) || activityCount >= 2;
    const isGuest = Boolean(participant.isGuest);
    const meetingPoint = participant.meetingPoint || participant.trekTime || '';
    const trekDate = participant.trekDate || participant.bookingDetails?.date || '';
    const peopleCount = Number(participant.people ?? participant.bookingDetails?.people ?? 1) || 1;
    const { gross: paidGross, net: paidNet, fee: paidFee } = paidAmounts(participant);
    const answerHighlights = (fields || [])
        .filter((f) => {
            const key = String(f.fieldName || '').toLowerCase();
            if (!f.value) return false;
            if (['full_name', 'name', 'email', 'contact_no', 'phone', 'gender'].includes(key)) return false;
            return true;
        })
        .slice(0, 4);
    const ops = getGuestOpsAnswers(participant);
    const bookingDetails = {
        date: trekDate,
        time: meetingPoint,
        people: peopleCount,
        amountPaid: Number(participant.amountPaid || participant.organizerNet || participant.bookingDetails?.amountPaid || 0),
        ...(participant.bookingDetails || {}),
    };

    const borderTone = checkedIn
        ? 'border-l-emerald-500'
        : pendingReview
            ? 'border-l-amber-400'
            : rejected
                ? 'border-l-red-500'
                : paid
                    ? 'border-l-[#0ECCEE]'
                    : 'border-l-gray-500';

    const statusHint = pendingReview
        ? 'Review'
        : rejected
            ? 'Rejected'
            : checkedIn
                ? 'In'
                : paid
                    ? 'Paid'
                    : participant.paymentStatus || '';

    return (
        <article className={`rounded-xl border border-white/10 border-l-[3px] ${borderTone} bg-[#161718] overflow-hidden ${selected ? 'ring-1 ring-[#0ECCEE]/50' : ''}`}>
            <div className={`flex items-center gap-2 ${contactOnly ? 'px-3 py-3' : 'p-3 sm:p-4 pb-0 items-start'}`}>
                {onToggleSelect ? (
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onToggleSelect(participant.bookingId)}
                        className="mt-0.5 rounded border-gray-600 shrink-0"
                        aria-label={`Select ${participant.participantName}`}
                    />
                ) : null}
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className={`flex-1 min-w-0 text-left flex gap-3 ${contactOnly ? 'items-start' : 'items-start pb-3 sm:pb-4'} -mr-1 pr-1 rounded-lg`}
                >
                    {contactOnly ? (
                        <span className="mt-0.5 shrink-0 size-6 rounded-md bg-white/5 border border-white/10 text-[11px] font-semibold tabular-nums text-gray-400 flex items-center justify-center">
                            {index}
                        </span>
                    ) : (
                        <div className="relative shrink-0">
                            <div className="size-10 sm:size-11 rounded-xl bg-[#0ECCEE]/15 text-[#0ECCEE] flex items-center justify-center text-sm font-bold">
                                {initials(participant.participantName)}
                            </div>
                            <span className="absolute -bottom-1 -right-1 size-5 rounded-full bg-[#111213] border border-gray-700 text-[9px] font-bold text-gray-400 flex items-center justify-center">
                                {index}
                            </span>
                        </div>
                    )}

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                            <h3 className="font-semibold text-[15px] sm:text-base truncate text-white">
                                {participant.participantName}
                            </h3>
                            {contactOnly && statusHint ? (
                                <span className={`shrink-0 text-[10px] font-semibold ${
                                    pendingReview ? 'text-amber-400'
                                        : checkedIn ? 'text-emerald-400'
                                            : paid ? 'text-[#0ECCEE]'
                                                : rejected ? 'text-red-400'
                                                    : 'text-gray-500'
                                }`}>
                                    {statusHint}
                                </span>
                            ) : null}
                        </div>

                        {contactOnly ? (
                            <div className="mt-0.5 space-y-1">
                                <p className="text-sm text-gray-400 truncate">
                                    {phone || 'No phone'}
                                </p>
                                {(ops.drink || ops.skill || ops.gender) ? (
                                    <div className="flex flex-wrap gap-1.5">
                                        {ops.drink ? (
                                            <span className="inline-flex max-w-full truncate text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-200 border border-amber-500/25">
                                                {shortOpsLabel(ops.drink.value)}
                                            </span>
                                        ) : null}
                                        {ops.skill ? (
                                            <span className="inline-flex max-w-full truncate text-[11px] font-medium px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-200 border border-sky-500/25">
                                                {shortOpsLabel(ops.skill.value)}
                                            </span>
                                        ) : null}
                                        {ops.gender ? (
                                            <span className="inline-flex text-[11px] font-medium px-2 py-0.5 rounded-md bg-white/5 text-gray-300 border border-white/10">
                                                {shortOpsLabel(ops.gender.value)}
                                            </span>
                                        ) : null}
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-gray-600">No post game fuel / skill on file</p>
                                )}
                            </div>
                        ) : (
                            <>
                        <div className="flex flex-wrap gap-1.5 mb-1.5 mt-1">
                            <Pill tone={pendingReview ? 'pending' : rejected ? 'pending' : paid ? 'paid' : 'free'}>
                                {participant.paymentStatus}
                            </Pill>
                            {participant.paymentMethodLabel && !pendingReview ? (
                                <Pill tone={participant.paymentGateway === 'cashfree' ? 'paid' : 'neutral'}>
                                    {participant.paymentMethodLabel}
                                </Pill>
                            ) : null}
                            {isGuest ? <Pill tone="guest">Guest</Pill> : null}
                            {participant.tierName ? (
                                <Pill tone="paid">{participant.tierName}</Pill>
                            ) : null}
                            {participant.addOnSelected && participant.addOnLabel ? (
                                <Pill tone="paid">+ {participant.addOnLabel}</Pill>
                            ) : null}
                            {participant.participantGender && participant.participantGender !== '—' ? (
                                <Pill tone="neutral">{participant.participantGender}</Pill>
                            ) : null}
                            {participant.couponCode ? (
                                <Pill tone="paid">
                                    {participant.couponCode}
                                    {Number(participant.couponDiscount) > 0
                                        ? ` · −₹${Number(participant.couponDiscount).toLocaleString('en-IN')}`
                                        : ''}
                                </Pill>
                            ) : null}
                            <Pill tone={checkedIn ? 'in' : 'pending'}>
                                {checkedIn ? 'Checked in' : 'Awaiting'}
                            </Pill>
                            {isRepeat ? (
                                <Pill tone="repeat">Repeat · {activityCount} {activityLabelPlural}</Pill>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[#0ECCEE]/20 bg-[#0ECCEE]/10 text-[#0ECCEE]">
                                    <Mountain size={10} /> {activityCount} {activityLabelSingular}
                                </span>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
                            {phone ? (
                                <span className="inline-flex items-center gap-1 font-medium text-gray-300">
                                    <Phone size={12} className="text-[#0ECCEE]" />{phone}
                                </span>
                            ) : null}
                            {trekDate ? (
                                <span className="inline-flex items-center gap-1 text-gray-300">
                                    <Calendar size={12} className="text-[#0ECCEE]" />
                                    {trekDate}
                                </span>
                            ) : null}
                            {meetingPoint ? (
                                <span className="inline-flex items-center gap-1 text-gray-300 min-w-0">
                                    <MapPin size={12} className="text-[#0ECCEE] shrink-0" />
                                    <span className="truncate">{meetingPoint}</span>
                                </span>
                            ) : null}
                            <span className="inline-flex items-center gap-1">
                                <Users size={12} />
                                {peopleCount} {peopleCount === 1 ? 'person' : 'people'}
                            </span>
                            {paidNet > 0 ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-emerald-400 tabular-nums">
                                    {rupee(paidNet)}
                                    {peopleCount > 1 ? ' total' : ''}
                                    {paidFee > 0 ? ` after 1.6%` : ''}
                                    {Number(participant.listAmount) > paidGross
                                        ? ` · list ${rupee(participant.listAmount)}`
                                        : ''}
                                </span>
                            ) : null}
                            {answerHighlights.map((field) => (
                                <span
                                    key={field.fieldName}
                                    className="inline-flex items-center max-w-[16rem] truncate text-[11px] text-gray-300"
                                    title={`${field.label}: ${field.value}`}
                                >
                                    {field.value}
                                </span>
                            ))}
                            {pendingReview && participant.transactionId ? (
                                <span className="inline-flex items-center gap-1 font-mono text-amber-300/90 max-w-full truncate">
                                    UTR · {participant.transactionId}
                                </span>
                            ) : null}
                            {!isOpen && fields.length > 0 ? (
                                <span className="text-gray-600">
                                    {fields.length} form field{fields.length === 1 ? '' : 's'} · tap to view
                                </span>
                            ) : null}
                        </div>
                            </>
                        )}
                    </div>

                    {!contactOnly && participant.paymentScreenshotUrl ? (
                        <img
                            src={participant.paymentScreenshotUrl}
                            alt=""
                            className="size-12 rounded-lg object-cover border border-gray-700 shrink-0 mt-0.5"
                        />
                    ) : null}
                    <ChevronDown
                        size={18}
                        className={`text-gray-500 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${contactOnly ? 'mt-1' : 'mt-1'}`}
                    />
                </button>
            </div>

            <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                    <div className="px-3 sm:px-4 pb-4 border-t border-gray-800/80 space-y-3">
                        <div className="flex flex-wrap gap-2 pt-3">
                            {phone ? (
                                <>
                                    <a
                                        href={`tel:${phone.replace(/\s/g, '')}`}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg bg-[#0ECCEE]/10 text-[#0ECCEE] text-xs font-medium"
                                    >
                                        <Phone size={13} /> Call
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => copyText(phone, () => onCopied?.('Phone copied'))}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-gray-700 text-xs text-gray-300"
                                    >
                                        <Copy size={13} /> Copy phone
                                    </button>
                                    {onWhatsApp ? (
                                        <button
                                            type="button"
                                            disabled={!canWhatsApp}
                                            onClick={() => onWhatsApp(participant)}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg bg-[#25D366]/15 text-[#25D366] text-xs font-semibold border border-[#25D366]/25 disabled:opacity-40"
                                        >
                                            <MessageCircle size={13} /> WhatsApp
                                        </button>
                                    ) : null}
                                </>
                            ) : null}
                            {onOpenCrm ? (
                                <button
                                    type="button"
                                    onClick={() => onOpenCrm(participant)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-[#0ECCEE]/30 bg-[#0ECCEE]/10 text-xs text-[#0ECCEE] font-medium"
                                >
                                    <ContactRound size={13} /> Open in CRM
                                </button>
                            ) : null}
                            <button
                                type="button"
                                onClick={() => copyText(participant.bookingId, () => onCopied?.('Booking ID copied'))}
                                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-gray-700 text-xs text-gray-300"
                            >
                                <Copy size={13} /> Copy ID
                            </button>
                            {onResend ? (
                                <button
                                    type="button"
                                    onClick={() => onResend(participant.bookingId)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-gray-700 text-xs text-gray-300 hover:border-[#0ECCEE]/40 hover:text-[#0ECCEE]"
                                >
                                    <MessageCircle size={13} /> Resend ticket
                                </button>
                            ) : null}
                            {onNotify ? (
                                <button
                                    type="button"
                                    onClick={() => onNotify(participant)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-gray-700 text-xs text-gray-300 hover:border-[#0ECCEE]/40 hover:text-[#0ECCEE]"
                                >
                                    <Bell size={13} /> Message
                                </button>
                            ) : null}
                            {onSendEmail ? (
                                <button
                                    type="button"
                                    onClick={() => onSendEmail(participant)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-gray-700 text-xs text-gray-300 hover:border-[#0ECCEE]/40 hover:text-[#0ECCEE]"
                                >
                                    <Mail size={13} /> Email
                                </button>
                            ) : null}
                            {onDelete ? (
                                <button
                                    type="button"
                                    onClick={() => onDelete(participant.bookingId, participant.participantName)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-red-900/50 text-xs text-red-400"
                                >
                                    <Trash2 size={13} /> Delete
                                </button>
                            ) : null}
                        </div>

                        {pendingReview || participant.paymentScreenshotUrl || paidNet > 0 ? (
                            <div className={`rounded-xl border p-3 space-y-2 ${
                                pendingReview
                                    ? 'border-amber-500/30 bg-amber-500/5'
                                    : 'border-white/10 bg-black/20'
                            }`}>
                                <p className={`text-[11px] font-semibold uppercase tracking-wider ${pendingReview ? 'text-amber-300' : 'text-gray-400'}`}>
                                    Payment
                                </p>
                                {paidNet > 0 ? (
                                    <p className="text-sm font-semibold tabular-nums text-emerald-300">
                                        {rupee(paidNet)}
                                        {peopleCount > 1
                                            ? ` · ${peopleCount} people`
                                            : ''}
                                    </p>
                                ) : null}
                                {paidFee > 0 ? (
                                    <p className="text-[11px] text-gray-500">
                                        Paid {rupee(paidGross)} · 1.6% Cashfree {rupee(paidFee)}
                                    </p>
                                ) : null}
                                {participant.couponCode ? (
                                    <p className="text-xs text-[#0ECCEE]">
                                        Coupon {participant.couponCode}
                                        {Number(participant.couponDiscount) > 0
                                            ? ` · −₹${Number(participant.couponDiscount).toLocaleString('en-IN')}`
                                            : ''}
                                        {Number(participant.listAmount) > 0
                                            ? ` · list ₹${Number(participant.listAmount).toLocaleString('en-IN')}`
                                            : ''}
                                    </p>
                                ) : null}
                                {participant.paymentScreenshotUrl ? (
                                    <a href={participant.paymentScreenshotUrl} target="_blank" rel="noopener noreferrer" className="block">
                                        <img
                                            src={participant.paymentScreenshotUrl}
                                            alt="Payment screenshot"
                                            className="max-h-44 w-full rounded-lg border border-gray-700 object-contain bg-black/40"
                                        />
                                    </a>
                                ) : pendingReview ? (
                                    <p className="text-sm text-gray-500">No screenshot</p>
                                ) : null}
                                {participant.transactionId ? (
                                    <p className="text-xs text-gray-400">
                                        Txn: <span className="text-gray-200 font-mono">{participant.transactionId}</span>
                                    </p>
                                ) : null}
                                {pendingReview && onReviewPayment ? (
                                    <button
                                        type="button"
                                        onClick={() => onReviewPayment(participant)}
                                        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 min-h-[48px] rounded-xl bg-amber-400 text-black text-sm font-bold"
                                    >
                                        Review payment
                                    </button>
                                ) : null}
                                {pendingReview && !onReviewPayment && (onApprovePayment || onRejectPayment) ? (
                                    <div className="flex gap-2">
                                        {onApprovePayment ? (
                                            <button
                                                type="button"
                                                onClick={() => onApprovePayment(participant.bookingId)}
                                                className="flex-1 py-2.5 rounded-lg bg-emerald-500 text-black text-xs font-bold"
                                            >
                                                Approve
                                            </button>
                                        ) : null}
                                        {onRejectPayment ? (
                                            <button
                                                type="button"
                                                onClick={() => onRejectPayment(participant.bookingId)}
                                                className="flex-1 py-2.5 rounded-lg border border-red-500/40 text-xs text-red-400"
                                            >
                                                Reject
                                            </button>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        ) : null}

                        {participant.addOnSelected && participant.addOnLabel ? (
                            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                                <span className="font-semibold text-emerald-300">Add-on · </span>
                                {participant.addOnLabel}
                                {Number(participant.addOnFee) > 0
                                    ? ` · ₹${Number(participant.addOnFee).toLocaleString('en-IN')}/person`
                                    : ''}
                                {(participant.people ?? 1) > 1 && Number(participant.addOnFee) > 0
                                    ? ` · ₹${Number(participant.addOnTotal || (participant.addOnFee * participant.people)).toLocaleString('en-IN')} total`
                                    : ''}
                            </div>
                        ) : null}

                        <div>
                            <TrekRegistrationResponses
                                fields={fields}
                                bookingDetails={bookingDetails}
                                userEmail={email}
                                phone={phone}
                                gender={participant.participantGender}
                                skipNamePhone
                                compact
                            />
                            {extraExpandedContent}
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 pt-1">
                            <span className="inline-flex items-center gap-1">
                                {checkedIn ? (
                                    <CheckCircle size={12} className="text-emerald-400" />
                                ) : (
                                    <Clock size={12} className="text-amber-400" />
                                )}
                                {checkedIn && participant.checkedInAt
                                    ? `Checked in ${formatShortDate(participant.checkedInAt)}`
                                    : `Registered ${formatShortDate(participant.bookingDate)}`}
                            </span>
                            {(participant.organizerNet ?? 0) > 0 ? (
                                <span className="text-emerald-400 font-medium">
                                    ₹{Number(participant.organizerNet).toLocaleString('en-IN')}
                                </span>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
        </article>
    );
}
