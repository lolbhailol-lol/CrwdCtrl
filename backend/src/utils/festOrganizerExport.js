const ExcelJS = require('exceljs');

function escapeCsv(value) {
    const s = String(value ?? '');
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function buildParticipantExportTable(participants = []) {
    const header = [
        'id', 'name', 'email', 'phone', 'team', 'college', 'city', 'year', 'course',
        'status', 'paymentStatus', 'amountPaid', 'checkedIn', 'competition', 'submittedAt',
    ];
    const body = participants.map((p) => [
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
    ]);
    return { header, body };
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
        column.width = Math.min(42, Math.max(12, max + 2));
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}

module.exports = {
    buildParticipantExportTable,
    participantsToCsv,
    participantsToXlsx,
};
