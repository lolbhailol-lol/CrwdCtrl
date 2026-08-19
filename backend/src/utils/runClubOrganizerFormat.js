const {
    pickFormField,
    buildRegistrationFields,
    formatFormValue,
    humanizeFieldName,
    participantsToCsv,
    participantsToXlsx,
} = require('./trekOrganizerFormat');

/** Keys persisted on responses for ops — not guest form answers. */
const INTERNAL_FORM_KEYS = new Set([
    'people',
    'date',
    'time',
    'tierid',
    'tiername',
    'tierfee',
    'addonselected',
    'addonlabel',
    'addonfee',
    'coupon_code',
    'couponcode',
    'name',
    'phone',
]);

const DEFAULT_CONTACT_FIELDS = [
    { fieldName: 'full_name', label: 'Full Name', type: 'text' },
    { fieldName: 'contact_no', label: 'Contact No.', type: 'tel' },
    { fieldName: 'email', label: 'E-mail', type: 'email' },
];

function mergeFormSchemaForDisplay(formSchema = []) {
    const custom = (Array.isArray(formSchema) ? formSchema : []).filter((f) => f?.fieldName);
    const seen = new Set(custom.map((f) => String(f.fieldName).toLowerCase()));
    const defaults = DEFAULT_CONTACT_FIELDS.filter((f) => !seen.has(f.fieldName));
    return [...defaults, ...custom];
}

function isInternalFormKey(key) {
    return INTERNAL_FORM_KEYS.has(String(key || '').toLowerCase());
}

function filterRegistrationFields(fields = []) {
    return (fields || []).filter((f) => !isInternalFormKey(f?.fieldName));
}

function responsesToObject(reg) {
    if (!reg?.responses) return {};
    if (reg.responses instanceof Map) {
        return Object.fromEntries(reg.responses);
    }
    return typeof reg.responses === 'object' ? reg.responses : {};
}

function normalizeRegistrationForFormat(reg) {
    const formData = responsesToObject(reg);
    const user = reg.user && typeof reg.user === 'object' ? reg.user : null;
    const amountPaid = Number(reg.amountPaid) || 0;
    const people = Math.max(
        1,
        Number(reg.bookingPeople) || Number(formData.people) || 1,
    );

    return {
        _id: reg._id,
        formData,
        userId: user,
        userName: user?.name || reg.guestName || pickFormField(formData, ['full_name', 'name']) || '',
        userEmail: user?.email || reg.guestEmail || pickFormField(formData, ['email', 'e_mail', 'Email']) || '',
        bookingDetails: {
            date: reg.bookingDate || pickFormField(formData, ['date', 'run_date', 'booking_date', 'event_date']) || '',
            time: reg.bookingTime || pickFormField(formData, ['time', 'time_slot', 'reporting_time']) || '',
            people,
            amountPaid,
            paymentId: reg.payment_id || '',
            payment_order_id: reg.payment_order_id || '',
        },
        checkedIn: !!reg.checkedIn,
        checkedInAt: reg.checkedInAt || null,
        status: reg.status || 'confirmed',
        createdAt: reg.createdAt,
        updatedAt: reg.updatedAt,
        qrCodeData: reg.qrCodeData || '',
    };
}

function formatParticipantRow(reg, event = null) {
    const booking = normalizeRegistrationForFormat(reg);
    const form = booking.formData;
    const grossCollected = Number(booking.bookingDetails.amountPaid) || 0;
    const people = Number(booking.bookingDetails.people) || 1;
    const tierName = String(reg.tierName || form.tierName || '').trim();
    const tierId = String(reg.tierId || form.tierId || '').trim();
    const tierFee = Number(reg.tierFee) || Number(form.tierFee) || 0;
    const addOnSelected = reg.addOnSelected === true
        || form.addOnSelected === true
        || form.addOnSelected === 'true'
        || form.addOnSelected === 1;
    const addOnLabel = String(reg.addOnLabel || form.addOnLabel || '').trim();
    const addOnFee = Math.max(0, Number(reg.addOnFee) || Number(form.addOnFee) || 0);
    const addOnTotal = addOnSelected ? addOnFee * people : 0;

    return {
        bookingId: String(reg._id),
        qrStatus: booking.checkedIn ? 'Checked In' : 'Pending',
        participantName:
            pickFormField(form, ['full_name', 'name', 'fullname', 'Full Name']) ||
            booking.userName ||
            reg.guestName ||
            '—',
        phone:
            pickFormField(form, ['contact_no', 'phone', 'mobile', 'contact']) ||
            booking.userId?.phoneNumber ||
            '—',
        participantGender:
            reg.participantGender
            || pickFormField(form, ['gender', 'sex', 'Gender'])
            || booking.userId?.gender
            || '—',
        emergencyContact:
            pickFormField(form, ['emergency_contact', 'emergency', 'emergency_phone', 'guardian_contact']) ||
            '—',
        paymentStatus:
            booking.status === 'cancelled' && (reg.paymentStatus === 'failed' || reg.paymentReviewNote)
                ? 'Rejected'
                : reg.paymentStatus === 'pending' || booking.status === 'pending'
                    ? 'Pending review'
                    : grossCollected > 0 || reg.paymentStatus === 'paid'
                        ? 'Paid'
                        : 'Free',
        amountPaid: grossCollected,
        people,
        bookingDate: booking.createdAt,
        trekDate: booking.bookingDetails.date || (event?.eventDate ? new Date(event.eventDate).toLocaleDateString('en-IN') : ''),
        trekTime: booking.bookingDetails.time || event?.reportingTime || '',
        checkInStatus: booking.checkedIn ? 'Checked In' : 'Pending',
        checkedInAt: booking.checkedInAt,
        status: booking.status,
        userEmail: booking.userEmail
            || reg.guestEmail
            || pickFormField(form, ['email', 'e_mail', 'e_mail_id', 'Email'])
            || '',
        email: booking.userEmail
            || reg.guestEmail
            || pickFormField(form, ['email', 'e_mail', 'e_mail_id', 'Email'])
            || '',
        qrCodeData: booking.qrCodeData,
        trekName: event?.title || '',
        grossCollected,
        organizerNet: grossCollected,
        platformFee: 0,
        paymentScreenshotUrl: reg.paymentScreenshotUrl || '',
        transactionId: reg.transactionId || '',
        paymentReviewNote: reg.paymentReviewNote || '',
        paymentReviewedAt: reg.paymentReviewedAt || null,
        paymentGateway: reg.payment_gateway || '',
        paymentMethodLabel: (() => {
            const gateway = String(reg.payment_gateway || '').toLowerCase();
            if (gateway === 'cashfree') return 'Paid online';
            if (gateway === 'organizer_qr') {
                return reg.paymentStatus === 'pending' || booking.status === 'pending'
                    ? 'UPI · needs review'
                    : 'UPI / QR';
            }
            if (reg.paymentStatus === 'pending' || booking.status === 'pending') return 'Awaiting review';
            if (grossCollected > 0 || reg.paymentStatus === 'paid') return 'Paid';
            return reg.paymentStatus === 'free' ? 'Free' : '';
        })(),
        couponCode: reg.couponCode || '',
        couponDiscount: Number(reg.couponDiscount) || 0,
        amountBeforeDiscount: Number(reg.amountBeforeDiscount) || 0,
        // List price (before coupon) for organizer eyeballing screenshots
        listAmount: (() => {
            const before = Number(reg.amountBeforeDiscount) || 0;
            if (before > 0) return before;
            const entryPerPerson = tierFee || Number(event?.registrationFee) || 0;
            const addOnPerPerson = addOnSelected ? addOnFee : 0;
            return (entryPerPerson + addOnPerPerson) * people;
        })(),
        // What the runner was told to pay (after coupon)
        expectedAmount: Number(reg.amountPaid) || 0,
        tierName,
        tierId,
        tierFee,
        tierLabel: tierName
            ? (tierFee > 0
                ? `${tierName} · ₹${Number(tierFee).toLocaleString('en-IN')}/person`
                : `${tierName} · Free`)
            : '',
        addOnSelected,
        addOnLabel,
        addOnFee,
        addOnTotal,
        addOnLabelFull: addOnSelected && addOnLabel
            ? (addOnFee > 0
                ? `${addOnLabel} · ₹${Number(addOnFee).toLocaleString('en-IN')}/person`
                : addOnLabel)
            : '',
    };
}

function buildSheetColumns(formSchema = []) {
    const formCols = mergeFormSchemaForDisplay(formSchema)
        .filter((f) => !isInternalFormKey(f.fieldName))
        .map((f) => ({
            key: `form:${f.fieldName}`,
            fieldName: f.fieldName,
            label: f.label || humanizeFieldName(f.fieldName),
            type: f.type || 'text',
            group: 'form',
            minWidth: f.type === 'textarea' ? 220 : 140,
        }));

    return [
        { key: '_index', label: '#', group: 'system', sticky: true, minWidth: 46 },
        { key: 'bookingId', label: 'Booking ID', group: 'system', sticky: true, minWidth: 112 },
        { key: 'participantGender', label: 'Gender', group: 'booking', minWidth: 88 },
        ...formCols,
        { key: 'trekDate', label: 'Run Date', group: 'booking', minWidth: 118 },
        { key: 'trekTime', label: 'Time', group: 'booking', minWidth: 96 },
        { key: 'people', label: 'People', group: 'booking', minWidth: 72 },
        { key: 'tierLabel', label: 'Tier', group: 'booking', minWidth: 140 },
        { key: 'addOnLabelFull', label: 'Add-on', group: 'booking', minWidth: 160 },
        { key: 'couponCode', label: 'Coupon', group: 'status', minWidth: 96 },
        { key: 'couponDiscount', label: 'Discount (₹)', group: 'status', minWidth: 104 },
        { key: 'listAmount', label: 'List (₹)', group: 'status', minWidth: 88 },
        { key: 'paymentStatus', label: 'Payment', group: 'status', minWidth: 88 },
        { key: 'organizerNet', label: 'Revenue (₹)', group: 'status', minWidth: 104 },
        { key: 'checkInStatus', label: 'Check-in', group: 'status', minWidth: 100 },
        { key: 'checkedInAt', label: 'Check-in At', group: 'status', minWidth: 138 },
        { key: 'bookingDate', label: 'Registered', group: 'status', minWidth: 138 },
    ];
}

function formatParticipantSheetRow(reg, event = null) {
    const row = formatParticipantRow(reg, event);
    const formSchema = mergeFormSchemaForDisplay(event?.registration?.formSchema || []);
    const base = responsesToObject(reg);
    const formData = {
        ...base,
        // Ensure organizer always sees Google/profile contact even if schema omitted defaults
        ...(row.participantName && row.participantName !== '—'
            ? { full_name: base.full_name || row.participantName }
            : {}),
        ...(row.userEmail ? { email: base.email || row.userEmail } : {}),
        ...(row.phone && row.phone !== '—'
            ? { contact_no: base.contact_no || row.phone }
            : {}),
        ...(row.participantGender && row.participantGender !== '—'
            ? { gender: base.gender || row.participantGender }
            : {}),
    };
    return {
        ...row,
        formData,
        registrationFields: filterRegistrationFields(buildRegistrationFields(formSchema, formData)),
    };
}

function buildParticipantTimeline(reg, event = null) {
    const booking = normalizeRegistrationForFormat(reg);
    const items = [{ label: 'Registration created', at: booking.createdAt, status: 'done' }];
    const gross = Number(booking.bookingDetails.amountPaid) || 0;
    const isQrPending =
        booking.status === 'pending'
        || reg.paymentStatus === 'pending'
        || reg.payment_gateway === 'organizer_qr';

    if (gross > 0 || (reg.paymentScreenshotUrl && isQrPending)) {
        if (isQrPending && booking.status === 'pending') {
            items.push({
                label: 'Proof submitted',
                at: booking.createdAt,
                status: 'pending',
                detail: gross > 0 ? `₹${gross.toLocaleString('en-IN')} awaiting review` : 'Awaiting review',
            });
        } else if (gross > 0 && (reg.paymentStatus === 'paid' || booking.status === 'confirmed')) {
            items.push({
                label: 'Payment received',
                at: reg.paymentReviewedAt || booking.createdAt,
                status: 'done',
                detail: `₹${gross.toLocaleString('en-IN')}`,
            });
        } else if (gross > 0) {
            items.push({
                label: 'Payment recorded',
                at: booking.createdAt,
                status: 'done',
                detail: `₹${gross.toLocaleString('en-IN')}`,
            });
        }
    }
    if (booking.checkedIn && booking.checkedInAt) {
        items.push({ label: 'Checked in', at: booking.checkedInAt, status: 'done' });
    } else if (booking.status === 'confirmed') {
        items.push({ label: 'Awaiting check-in', at: null, status: 'pending' });
    }
    if (booking.status === 'cancelled') {
        items.push({ label: 'Registration cancelled', at: booking.updatedAt, status: 'cancelled' });
    }
    if (event?.eventDate && !booking.bookingDetails.date) {
        items.unshift({
            label: 'Run scheduled',
            at: event.eventDate,
            status: 'done',
            detail: event.title || '',
        });
    }
    return items;
}

function formatParticipantDetail(reg, event = null) {
    const row = formatParticipantRow(reg, event);
    const formSchema = mergeFormSchemaForDisplay(event?.registration?.formSchema || []);
    const baseForm = responsesToObject(reg);
    const formData = {
        ...baseForm,
        ...(row.participantName && row.participantName !== '—'
            ? { full_name: baseForm.full_name || row.participantName }
            : {}),
        ...(row.userEmail ? { email: baseForm.email || row.userEmail } : {}),
        ...(row.phone && row.phone !== '—'
            ? { contact_no: baseForm.contact_no || row.phone }
            : {}),
        ...(row.participantGender && row.participantGender !== '—'
            ? { gender: baseForm.gender || row.participantGender }
            : {}),
    };
    const bd = normalizeRegistrationForFormat(reg).bookingDetails;

    return {
        ...row,
        formData,
        registrationFields: filterRegistrationFields(buildRegistrationFields(formSchema, formData)),
        bookingDetails: {
            ...bd,
            grossCollected: row.grossCollected,
            organizerNet: row.organizerNet,
            platformFee: 0,
            paymentId: bd.paymentId || bd.payment_order_id || '',
        },
        timeline: buildParticipantTimeline(reg, event),
    };
}

module.exports = {
    responsesToObject,
    normalizeRegistrationForFormat,
    formatParticipantRow,
    formatParticipantDetail,
    formatParticipantSheetRow,
    buildSheetColumns,
    mergeFormSchemaForDisplay,
    INTERNAL_FORM_KEYS,
    participantsToCsv,
    participantsToXlsx,
};
