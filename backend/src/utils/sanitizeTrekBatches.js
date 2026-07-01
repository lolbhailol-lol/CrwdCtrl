function sanitizeTrekBatches(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map((b) => ({
            date: String(b?.date || '').trim(),
            batchSize: Math.max(0, parseInt(b?.batchSize, 10) || 0),
            timing: String(b?.timing || '').trim(),
            note: String(b?.note || '').trim(),
        }))
        .filter((b) => b.date || b.batchSize || b.timing || b.note);
}

module.exports = { sanitizeTrekBatches };
