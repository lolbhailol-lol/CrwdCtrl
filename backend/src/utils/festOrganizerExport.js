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

function collectFormFieldKeys(participants = []) {
    const keys = new Set();
    for (const p of participants) {
        const responses = p?.responses && typeof p.responses === 'object' ? p.responses : {};
        for (const key of Object.keys(responses)) {
            if (!key || key.startsWith('_') || CORE_RESPONSE_SKIP.has(key)) continue;
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
};
