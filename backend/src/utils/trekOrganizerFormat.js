function humanizeFieldName(key) {
    return String(key)
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatFormValue(value) {
    if (value === null || value === undefined || value === '') return '';
    if (Array.isArray(value)) return value.filter((v) => v !== '' && v != null).join(', ');
    if (typeof value === 'object') {
        if (value.uploaded) {
            return value.cloudinaryLink || value.driveLink || 'File uploaded';
        }
        return JSON.stringify(value);
    }
    if (value === true || value === 'true') return 'Yes';
    if (value === false || value === 'false') return 'No';
    return String(value);
}

function isFileValue(raw) {
    return raw && typeof raw === 'object' && raw.uploaded;
}

function buildRegistrationFields(formSchema = [], formData = {}) {
    const form = formData && typeof formData === 'object' ? formData : {};
    const usedKeys = new Set();
    const fields = [];

    for (const field of Array.isArray(formSchema) ? formSchema : []) {
        const fieldName = field?.fieldName;
        if (!fieldName) continue;
        usedKeys.add(fieldName);
        const raw = form[fieldName];
        if (raw === null || raw === undefined || raw === '') continue;
        fields.push({
            label: field.label || humanizeFieldName(fieldName),
            fieldName,
            type: field.type || 'text',
            value: formatFormValue(raw),
            rawValue: raw,
            isFile: isFileValue(raw),
            fileUrl: isFileValue(raw)
                ? (raw.cloudinaryLink || (String(raw.driveLink || '').startsWith('http') ? raw.driveLink : null))
                : null,
        });
    }

    for (const [key, raw] of Object.entries(form)) {
        if (usedKeys.has(key)) continue;
        if (raw === null || raw === undefined || raw === '') continue;
        fields.push({
            label: humanizeFieldName(key),
            fieldName: key,
            type: 'text',
            value: formatFormValue(raw),
            rawValue: raw,
            isFile: isFileValue(raw),
            fileUrl: isFileValue(raw)
                ? (raw.cloudinaryLink || (String(raw.driveLink || '').startsWith('http') ? raw.driveLink : null))
                : null,
        });
    }

    return fields;
}

function pickFormField(formData = {}, keys = []) {
    for (const key of keys) {
        const val = formData[key];
        if (val !== undefined && val !== null && String(val).trim()) return String(val).trim();
    }
    return '';
}

const { splitTrekOrganizerPayment } = require('./platformFee');

function attachOrganizerPayment(row, booking, trek = null) {
    const grossCollected = Number(booking.bookingDetails?.amountPaid) || 0;
    const people = Number(booking.bookingDetails?.people) || 1;
    const split = splitTrekOrganizerPayment(grossCollected, trek?.platformFeePercent ?? 3, {
        registrationFeePerPerson: trek?.registrationFee ?? 0,
        people,
    });
    return {
        ...row,
        grossCollected: split.grossCollected,
        organizerNet: split.organizerNet,
        platformFee: split.platformFee,
    };
}

function formatParticipantRow(booking, trek = null) {
    const form = booking.formData || {};
    const grossCollected = Number(booking.bookingDetails?.amountPaid) || 0;
    const people = Number(booking.bookingDetails?.people) || 1;
    const isQrPending = booking.status === 'pending'
        || booking.paymentStatus === 'pending'
        || (booking.payment_gateway === 'organizer_qr' && booking.status === 'pending');
    const isRejected = booking.status === 'cancelled'
        && (booking.paymentStatus === 'failed' || booking.paymentReviewNote);

    const meetingPoint = String(booking.bookingDetails?.time || '').trim();
    const hasUserId = Boolean(booking.userId && (booking.userId._id || booking.userId));

    const row = {
        bookingId: String(booking._id),
        qrStatus: booking.checkedIn ? 'Checked In' : 'Pending',
        participantName:
            pickFormField(form, ['full_name', 'name', 'fullname', 'Full Name']) ||
            booking.userName ||
            booking.userId?.name ||
            '—',
        phone:
            pickFormField(form, ['contact_no', 'phone', 'mobile', 'contact']) ||
            booking.userId?.phoneNumber ||
            '—',
        emergencyContact:
            pickFormField(form, ['emergency_contact', 'emergency', 'emergency_phone', 'guardian_contact']) ||
            '—',
        paymentStatus: isRejected
            ? 'Rejected'
            : isQrPending
                ? 'Pending review'
                : (grossCollected > 0 || booking.paymentStatus === 'paid')
                    ? 'Paid'
                    : 'Free',
        amountPaid: grossCollected,
        people,
        bookingDate: booking.createdAt,
        trekDate: booking.bookingDetails?.date || '',
        trekTime: meetingPoint,
        meetingPoint,
        isGuest: !hasUserId,
        bookingDetails: {
            date: booking.bookingDetails?.date || '',
            time: meetingPoint,
            people,
            amountPaid: grossCollected,
        },
        checkInStatus: booking.checkedIn ? 'Checked In' : 'Pending',
        checkedInAt: booking.checkedInAt || null,
        status: booking.status || 'confirmed',
        userEmail: booking.userEmail || booking.userId?.email || pickFormField(form, ['email', 'e_mail']),
        participantGender: booking.participantGender || pickFormField(form, ['gender', 'sex', 'Gender']) || booking.userId?.gender || '—',
        qrCodeData: booking.qrCodeData || '',
        trekName: trek?.trekName || booking.trekId?.trekName || '',
        paymentScreenshotUrl: booking.paymentScreenshotUrl || '',
        transactionId: booking.transactionId || '',
        paymentReviewNote: booking.paymentReviewNote || '',
        paymentReviewedAt: booking.paymentReviewedAt || null,
        paymentGateway: booking.payment_gateway || '',
        expectedAmount: grossCollected,
        listAmount: Number(trek?.registrationFee) > 0
            ? Number(trek.registrationFee) * people
            : grossCollected,
    };

    return attachOrganizerPayment(row, booking, trek);
}

function resolveFormColumns(formSchema = []) {
    if (Array.isArray(formSchema) && formSchema.length) {
        return formSchema.filter((f) => f?.fieldName);
    }
    return [
        { fieldName: 'full_name', label: 'Full Name', type: 'text' },
        { fieldName: 'contact_no', label: 'Contact No.', type: 'tel' },
        { fieldName: 'email', label: 'E-mail', type: 'email' },
        { fieldName: 'id_proof', label: 'ID Proof', type: 'file' },
    ];
}

function buildSheetColumns(formSchema = []) {
    const formCols = resolveFormColumns(formSchema).map((f) => ({
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
        { key: 'trekDate', label: 'Trek Date', group: 'booking', minWidth: 118 },
        { key: 'trekTime', label: 'Meeting Point / Time', group: 'booking', minWidth: 140 },
        { key: 'people', label: 'People', group: 'booking', minWidth: 72 },
        { key: 'paymentStatus', label: 'Payment', group: 'status', minWidth: 88 },
        { key: 'organizerNet', label: 'Your share (₹)', group: 'status', minWidth: 104 },
        { key: 'grossCollected', label: 'Customer paid (₹)', group: 'status', minWidth: 112 },
        { key: 'checkInStatus', label: 'Check-in', group: 'status', minWidth: 100 },
        { key: 'checkedInAt', label: 'Check-in At', group: 'status', minWidth: 138 },
        { key: 'bookingDate', label: 'Registered', group: 'status', minWidth: 138 },
    ];
}

function formatParticipantSheetRow(booking, trek = null) {
    const row = formatParticipantRow(booking, trek);
    const formSchema = trek?.registration?.formSchema || [];
    return {
        ...row,
        formData: booking.formData || {},
        registrationFields: buildRegistrationFields(formSchema, booking.formData || {}),
    };
}

function buildParticipantTimeline(booking, trek = null) {
    const items = [
        {
            label: 'Booking created',
            at: booking.createdAt,
            status: 'done',
        },
    ];
    const split = splitTrekOrganizerPayment(
        booking.bookingDetails?.amountPaid,
        trek?.platformFeePercent ?? 3,
        {
            registrationFeePerPerson: trek?.registrationFee ?? 0,
            people: booking.bookingDetails?.people,
        },
    );
    if (split.grossCollected > 0) {
        items.push({
            label: 'Payment received',
            at: booking.createdAt,
            status: 'done',
            detail: `Your share ₹${split.organizerNet.toLocaleString('en-IN')}${split.platformFee > 0 ? ` (customer paid ₹${split.grossCollected.toLocaleString('en-IN')})` : ''}`,
        });
    }
    if (booking.checkedIn && booking.checkedInAt) {
        items.push({
            label: 'Checked in',
            at: booking.checkedInAt,
            status: 'done',
        });
    } else if (booking.status === 'confirmed') {
        items.push({
            label: 'Awaiting check-in',
            at: null,
            status: 'pending',
        });
    }
    if (booking.status === 'cancelled') {
        items.push({
            label: 'Booking cancelled',
            at: booking.updatedAt,
            status: 'cancelled',
        });
    }
    return items;
}

function formatParticipantDetail(booking, trek = null) {
    const row = formatParticipantRow(booking, trek);
    const formSchema = trek?.registration?.formSchema || [];
    const registrationFields = buildRegistrationFields(formSchema, booking.formData || {});
    const bd = booking.bookingDetails || {};

    return {
        ...row,
        formData: booking.formData || {},
        registrationFields,
        bookingDetails: {
            ...bd,
            date: bd.date || '',
            time: bd.time || '',
            people: Number(bd.people) || 1,
            amountPaid: Number(bd.amountPaid) || 0,
            grossCollected: row.grossCollected,
            organizerNet: row.organizerNet,
            platformFee: row.platformFee,
            paymentId: bd.paymentId || bd.payment_order_id || '',
        },
        timeline: buildParticipantTimeline(booking, trek),
    };
}

function escapeCsv(value) {
    const str = String(value ?? '');
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
}

function buildParticipantExportTable(rows, options = {}) {
    const formSchema = Array.isArray(options.formSchema) ? options.formSchema : [];
    const includePaymentProof = Boolean(options.includePaymentProof);
    const requiredOnlyFormFields = Boolean(options.requiredOnlyFormFields);
    const minimalColumns = Boolean(options.minimalColumns);
    const dynamicCols = formSchema
        .filter((f) => (requiredOnlyFormFields ? Boolean(f?.required) : true))
        .filter((f) => f?.fieldName)
        .map((f) => ({ key: f.fieldName, label: f.label || humanizeFieldName(f.fieldName) }));

    if (!requiredOnlyFormFields) {
        const skipExtra = new Set([
            'people', 'date', 'time',
            'tierid', 'tiername', 'tierfee',
            'addonselected', 'addonlabel', 'addonfee',
            'coupon_code', 'couponcode',
            'name', 'phone', 'fullname',
            'full_name', 'contact_no', 'email',
            'gender', 'sex',
        ]);
        const extraKeys = new Set();
        for (const row of rows) {
            const form = row.formData || {};
            for (const key of Object.keys(form)) {
                if (skipExtra.has(String(key).toLowerCase())) continue;
                if (!dynamicCols.some((c) => c.key === key)) extraKeys.add(key);
            }
        }
        for (const key of extraKeys) {
            dynamicCols.push({ key, label: humanizeFieldName(key) });
        }
    }

    if (minimalColumns) {
        const header = [
            'Participant Name',
            'Email',
            'Registration Status',
            'QR Scan Status',
            'Check-in Time',
        ];
        const body = rows.map((r) => [
            r.participantName,
            r.userEmail || '',
            r.status || '',
            r.checkInStatus || r.qrStatus || '',
            r.checkedInAt ? new Date(r.checkedInAt).toISOString() : '',
        ]);
        return { header, body };
    }

    const header = [
        'Booking ID',
        'QR Status',
        'Participant Name',
        'Gender',
        'Phone',
        'Emergency Contact',
        'Payment Status',
        'Registration Status',
        'Your Share (Organizer)',
        'Platform Fee (CrwdCtrl)',
        'Customer Paid (Total)',
        'People',
        'Coupon Code',
        'Discount (₹)',
        'List Amount (₹)',
        'Booking Date',
        'Trek Date',
        'Meeting Point / Time',
        'Check-in Status',
        'Check-in Time',
        'Email',
        ...(includePaymentProof
            ? ['Transaction ID', 'Payment Screenshot URL', 'Payment Review Note']
            : []),
        ...dynamicCols.map((c) => c.label),
    ];

    const body = rows.map((r) => {
        const form = r.formData || {};
        return [
            r.bookingId,
            r.qrStatus,
            r.participantName,
            r.participantGender || '—',
            r.phone,
            r.emergencyContact,
            r.paymentStatus,
            r.status || '',
            r.organizerNet ?? 0,
            r.platformFee ?? 0,
            r.grossCollected ?? r.amountPaid ?? 0,
            r.people,
            r.couponCode || '',
            Number(r.couponDiscount) || 0,
            Number(r.listAmount) || 0,
            r.bookingDate ? new Date(r.bookingDate).toISOString() : '',
            r.trekDate,
            r.trekTime,
            r.checkInStatus,
            r.checkedInAt ? new Date(r.checkedInAt).toISOString() : '',
            r.userEmail || '',
            ...(includePaymentProof
                ? [r.transactionId || '', r.paymentScreenshotUrl || '', r.paymentReviewNote || '']
                : []),
            ...dynamicCols.map((c) => formatFormValue(form[c.key])),
        ];
    });

    return { header, body };
}

function participantsToCsv(rows, options = {}) {
    const { header, body } = buildParticipantExportTable(rows, options);
    return `\uFEFF${[header, ...body].map((row) => row.map(escapeCsv).join(',')).join('\n')}`;
}

async function participantsToXlsx(rows, options = {}) {
    const ExcelJS = require('exceljs');
    const { header, body } = buildParticipantExportTable(rows, options);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CrwdCtrl';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Participants', {
        views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.addRow(header);
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: 'middle', wrapText: true };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8F8FC' },
    };

    body.forEach((row) => sheet.addRow(row));

    header.forEach((_, colIdx) => {
        const column = sheet.getColumn(colIdx + 1);
        let max = String(header[colIdx] || '').length;
        body.forEach((row) => {
            const len = String(row[colIdx] ?? '').length;
            if (len > max) max = len;
        });
        column.width = Math.min(42, Math.max(12, max + 2));
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}

module.exports = {
    formatParticipantRow,
    formatParticipantDetail,
    formatParticipantSheetRow,
    buildSheetColumns,
    resolveFormColumns,
    buildParticipantExportTable,
    participantsToCsv,
    participantsToXlsx,
    pickFormField,
    buildRegistrationFields,
    formatFormValue,
    humanizeFieldName,
};
