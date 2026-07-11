const {
    pickFormField,
    buildRegistrationFields,
    formatFormValue,
    humanizeFieldName,
    participantsToCsv,
} = require('./trekOrganizerFormat');

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
        userName: user?.name || '',
        userEmail: user?.email || pickFormField(formData, ['email', 'e_mail', 'Email']) || '',
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

    return {
        bookingId: String(reg._id),
        qrStatus: booking.checkedIn ? 'Checked In' : 'Pending',
        participantName:
            pickFormField(form, ['full_name', 'name', 'fullname', 'Full Name']) ||
            booking.userName ||
            '—',
        phone:
            pickFormField(form, ['contact_no', 'phone', 'mobile', 'contact']) ||
            booking.userId?.phoneNumber ||
            '—',
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
        userEmail: booking.userEmail,
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
        expectedAmount: event?.registrationFee != null
            ? (Number(event.registrationFee) || 0) * people
            : grossCollected,
    };
}

function buildSheetColumns(formSchema = []) {
    const formCols = (Array.isArray(formSchema) ? formSchema : [])
        .filter((f) => f?.fieldName)
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
        ...formCols,
        { key: 'trekDate', label: 'Run Date', group: 'booking', minWidth: 118 },
        { key: 'trekTime', label: 'Time', group: 'booking', minWidth: 96 },
        { key: 'people', label: 'People', group: 'booking', minWidth: 72 },
        { key: 'paymentStatus', label: 'Payment', group: 'status', minWidth: 88 },
        { key: 'organizerNet', label: 'Revenue (₹)', group: 'status', minWidth: 104 },
        { key: 'checkInStatus', label: 'Check-in', group: 'status', minWidth: 100 },
        { key: 'checkedInAt', label: 'Check-in At', group: 'status', minWidth: 138 },
        { key: 'bookingDate', label: 'Registered', group: 'status', minWidth: 138 },
    ];
}

function formatParticipantSheetRow(reg, event = null) {
    const row = formatParticipantRow(reg, event);
    const formSchema = event?.registration?.formSchema || [];
    const formData = responsesToObject(reg);
    return {
        ...row,
        formData,
        registrationFields: buildRegistrationFields(formSchema, formData),
    };
}

function buildParticipantTimeline(reg, event = null) {
    const booking = normalizeRegistrationForFormat(reg);
    const items = [{ label: 'Registration created', at: booking.createdAt, status: 'done' }];
    const gross = Number(booking.bookingDetails.amountPaid) || 0;

    if (gross > 0) {
        items.push({
            label: 'Payment received',
            at: booking.createdAt,
            status: 'done',
            detail: `₹${gross.toLocaleString('en-IN')}`,
        });
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
    const formSchema = event?.registration?.formSchema || [];
    const formData = responsesToObject(reg);
    const bd = normalizeRegistrationForFormat(reg).bookingDetails;

    return {
        ...row,
        formData,
        registrationFields: buildRegistrationFields(formSchema, formData),
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
    participantsToCsv,
};
