/**
 * Simple registration details list for trek (and similar) organizers.
 * One row per field — easy to scan on phone.
 */
function FieldValue({ field }) {
    if (field.isFile && field.fileUrl) {
        return (
            <a
                href={field.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0ECCEE] font-medium hover:underline"
            >
                Open file
            </a>
        );
    }
    if (field.isFile) {
        return <span className="text-emerald-400">File uploaded</span>;
    }
    const text = field.value == null || field.value === '' ? '—' : String(field.value);
    return <span className="text-gray-100 wrap-break-word whitespace-pre-wrap">{text}</span>;
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
    if (bookingDetails?.time) metaRows.push({ label: 'Time', value: bookingDetails.time });
    if (bookingDetails?.people) metaRows.push({ label: 'People', value: String(bookingDetails.people) });
    if (phone && phone !== '—') metaRows.push({ label: 'Phone', value: phone });
    if (userEmail && !hasEmailInFields) metaRows.push({ label: 'Email', value: userEmail });
    if (gender && gender !== '—' && !hasGenderInFields) metaRows.push({ label: 'Gender', value: gender });

    if (!visibleFields.length && !metaRows.length) {
        return <p className="text-sm text-gray-500 py-1">No form details saved.</p>;
    }

    const rowClass = compact
        ? 'flex gap-3 py-2 border-b border-gray-800/60 last:border-0'
        : 'flex gap-3 py-2.5 border-b border-gray-800/70 last:border-0';

    return (
        <div className="rounded-xl border border-gray-800 bg-[#111213] overflow-hidden">
            <div className="px-3 sm:px-4">
                {metaRows.map((row) => (
                    <div key={row.label} className={rowClass}>
                        <p className="w-[88px] sm:w-28 shrink-0 text-[11px] uppercase tracking-wide text-gray-500 pt-0.5">
                            {row.label}
                        </p>
                        <p className="flex-1 text-sm text-gray-100 wrap-break-word">{row.value}</p>
                    </div>
                ))}
                {visibleFields.map((field) => (
                    <div
                        key={field.fieldName}
                        className={`${rowClass} ${field.type === 'textarea' ? 'flex-col sm:flex-row' : ''}`}
                    >
                        <p className="w-[88px] sm:w-28 shrink-0 text-[11px] uppercase tracking-wide text-gray-500 pt-0.5">
                            {field.label}
                        </p>
                        <div className="flex-1 text-sm min-w-0">
                            <FieldValue field={field} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
