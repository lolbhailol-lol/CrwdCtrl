const ExcelJS = require('exceljs');

function escapeCsv(value) {
    const s = String(value ?? '');
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function humanizeFieldName(key = '') {
    return String(key)
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase()) || key;
}

function formatResponseCell(value) {
    if (value == null || value === '') return '';
    if (Array.isArray(value)) {
        return value
            .map((v) => (typeof v === 'object' ? (v?.url || v?.secure_url || JSON.stringify(v)) : String(v)))
            .filter(Boolean)
            .join('; ');
    }
    if (typeof value === 'object') {
        return value.url || value.secure_url || JSON.stringify(value);
    }
    return String(value);
}

const CORE_RESPONSE_SKIP = new Set([
    'manual_entry', 'added_by_organizer', 'organizer_note',
    'password', 'token', 'qr',
]);

/** Form keys that duplicate fixed Excel columns (name/email/phone/team/college/…) */
const IDENTITY_ALIASES = new Set([
    'name', 'full_name', 'fullname', 'leader_name', 'participant_name', 'user_name', 'username',
    'firstname', 'first_name', 'lastname', 'last_name',
    'email', 'email_id', 'emailid', 'e_mail', 'mail', 'user_email',
    'phone', 'mobile', 'contact', 'contact_no', 'contact_number', 'contact_num',
    'phone_number', 'phonenumber', 'mobile_number', 'whatsapp', 'whatsapp_number', 'user_phone',
    'team', 'team_name', 'teamname', 'group_name', 'band_name',
    'college', 'college_name', 'collegename', 'institution', 'university',
    'city', 'location', 'hometown',
    'year', 'year_of_study', 'academic_year', 'class', 'year_of_graduation',
    'course', 'branch', 'department', 'stream',
]);

function normalizeFormKey(key = '') {
    return String(key)
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
}

function isRedundantFormFieldKey(key) {
    const k = normalizeFormKey(key);
    if (!k || k.startsWith('_') || CORE_RESPONSE_SKIP.has(k)) return true;
    if (IDENTITY_ALIASES.has(k)) return true;
    if (/^(full|leader|participant|user|captain)_?name$/.test(k)) return true;
    if (/^(e[_]?mail|user_email|email_id)/.test(k)) return true;
    if (/^(phone|mobile|whatsapp|contact)/.test(k) && !/(emergency|parent|alt|guardian|secondary)/.test(k)) {
        return true;
    }
    if (/^(team|group|band)_?name$/.test(k)) return true;
    if (/^(college|institution|university)_?name$/.test(k)) return true;
    return false;
}

function collectFormFieldKeys(participants = []) {
    const keys = new Set();
    for (const p of participants) {
        const responses = p?.responses && typeof p.responses === 'object' ? p.responses : {};
        for (const key of Object.keys(responses)) {
            if (isRedundantFormFieldKey(key)) continue;
            keys.add(key);
        }
    }
    return Array.from(keys).sort((a, b) => a.localeCompare(b));
}

function buildParticipantExportTable(participants = []) {
    const formKeys = collectFormFieldKeys(participants);
    const header = [
        'id', 'name', 'email', 'phone', 'team', 'college', 'city', 'year', 'course',
        'status', 'paymentStatus', 'amountPaid', 'checkedIn', 'competition', 'submittedAt',
        ...formKeys.map(humanizeFieldName),
    ];
    const body = participants.map((p) => {
        const responses = p?.responses && typeof p.responses === 'object' ? p.responses : {};
        return [
            p.id || '',
            p.userName || '',
            p.userEmail || '',
            p.userPhone || '',
            p.teamName || '',
            p.college || '',
            p.city || '',
            p.year || '',
            p.course || '',
            p.status || '',
            p.paymentStatus || '',
            p.amountPaid ?? 0,
            p.checkedIn ? 'yes' : 'no',
            p.competitionName || '',
            p.submittedAt ? new Date(p.submittedAt).toISOString() : '',
            ...formKeys.map((key) => formatResponseCell(responses[key])),
        ];
    });
    return { header, body, formKeys };
}

function participantsToCsv(participants = []) {
    const { header, body } = buildParticipantExportTable(participants);
    return `\uFEFF${[header, ...body].map((row) => row.map(escapeCsv).join(',')).join('\n')}`;
}

async function participantsToXlsx(participants = [], { sheetName = 'Participants' } = {}) {
    const { header, body } = buildParticipantExportTable(participants);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CrwdCtrl';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(sheetName, {
        views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.addRow(header);
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
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
        column.width = Math.min(48, Math.max(12, max + 2));
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}

module.exports = {
    buildParticipantExportTable,
    participantsToCsv,
    participantsToXlsx,
    humanizeFieldName,
    formatResponseCell,
    isRedundantFormFieldKey,
};
