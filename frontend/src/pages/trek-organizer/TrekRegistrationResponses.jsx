/**
 * Premium registration details for trek organizers.
 * Clean labeled rows that stay easy to scan on phone.
 */
import { FileText, ExternalLink, Paperclip } from 'lucide-react';

function FieldValue({ field }) {
    if (field.isFile && field.fileUrl) {
        return (
            <a
                href={field.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[#0ECCEE] font-medium hover:underline"
            >
                <ExternalLink size={13} />
                Open file
            </a>
        );
    }
    if (field.isFile) {
        return (
            <span className="inline-flex items-center gap-1.5 text-emerald-400">
                <Paperclip size={13} />
                File uploaded
            </span>
        );
    }
    const text = field.value == null || field.value === '' ? '—' : String(field.value);
    return <span className="text-gray-100 wrap-break-word whitespace-pre-wrap leading-relaxed">{text}</span>;
}

const SKIP_KEYS = new Set([
    'full_name', 'name', 'fullname', 'contact_no', 'phone', 'mobile', 'whatsapp',
]);

function shouldSkipField(field, { skipNamePhone = true } = {}) {
    if (!skipNamePhone) return false;
    const key = String(field.fieldName || '').toLowerCase();
    const label = String(field.label || '').toLowerCase();
    if (SKIP_KEYS.has(key)) return true;
    if (label === 'name' || label === 'full name' || label === 'phone' || label === 'mobile') return true;
    return false;
}

function DetailRow({ label, children, tall = false }) {
    return (
        <div className={`grid grid-cols-1 sm:grid-cols-[9rem_1fr] gap-1 sm:gap-4 px-3.5 sm:px-4 ${tall ? 'py-3.5' : 'py-3'} border-b border-white/5 last:border-0`}>
            <p className="text-[11px] uppercase tracking-[0.08em] text-gray-500 font-medium pt-0.5">
                {label}
            </p>
            <div className="text-sm min-w-0">{children}</div>
        </div>
    );
}

export default function TrekRegistrationResponses({
    fields = [],
    bookingDetails = null,
    userEmail = '',
    phone = '',
    gender = '',
    skipNamePhone = true,
    compact = false,
}) {
    const visibleFields = (fields || []).filter((f) => !shouldSkipField(f, { skipNamePhone }));
    const hasEmailInFields = visibleFields.some(
        (f) => /email/i.test(f.fieldName || '') || /email/i.test(f.label || ''),
    );
    const hasGenderInFields = visibleFields.some(
        (f) => /gender/i.test(f.fieldName || '') || /gender/i.test(f.label || ''),
    );

    const metaRows = [];
    if (bookingDetails?.date) metaRows.push({ label: 'Date', value: bookingDetails.date });
    if (bookingDetails?.time) metaRows.push({ label: 'Meeting point', value: bookingDetails.time });
    if (bookingDetails?.people) metaRows.push({ label: 'People', value: String(bookingDetails.people) });
    const paidAmount = Number(bookingDetails?.amountPaid || bookingDetails?.grossCollected || 0);
    if (paidAmount > 0) {
        const peopleCount = Math.max(1, Number(bookingDetails?.people) || 1);
        metaRows.push({
            label: 'Amount paid',
            value: peopleCount > 1
                ? `₹${paidAmount.toLocaleString('en-IN')} · ${peopleCount} people`
                : `₹${paidAmount.toLocaleString('en-IN')}`,
        });
    }
    if (phone && phone !== '—') metaRows.push({ label: 'Phone', value: phone });
    if (userEmail && !hasEmailInFields) metaRows.push({ label: 'Email', value: userEmail });
    if (gender && gender !== '—' && !hasGenderInFields) metaRows.push({ label: 'Gender', value: gender });

    if (!visibleFields.length && !metaRows.length) {
        return (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center">
                <FileText size={18} className="mx-auto text-gray-600 mb-2" />
                <p className="text-sm text-gray-500">No form details saved.</p>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-white/10 bg-linear-to-b from-[#1a1b1d] to-[#121314] overflow-hidden">
            <div className={`flex items-center gap-2 px-3.5 sm:px-4 border-b border-white/5 bg-white/5 ${compact ? 'py-2' : 'py-2.5'}`}>
                <div className="size-7 rounded-lg bg-[#0ECCEE]/12 text-[#0ECCEE] flex items-center justify-center">
                    <FileText size={13} />
                </div>
                <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold">
                    Form details
                </p>
                <span className="ml-auto text-[10px] text-gray-600 tabular-nums">
                    {metaRows.length + visibleFields.length} fields
                </span>
            </div>

            <div>
                {metaRows.map((row) => (
                    <DetailRow key={row.label} label={row.label}>
                        <span className="text-gray-100 wrap-break-word">{row.value}</span>
                    </DetailRow>
                ))}
                {visibleFields.map((field) => (
                    <DetailRow
                        key={field.fieldName}
                        label={field.label}
                        tall={field.type === 'textarea' || String(field.value || '').length > 80}
                    >
                        <FieldValue field={field} />
                    </DetailRow>
                ))}
            </div>
        </div>
    );
}
