const EMPTY_BATCH = () => ({ date: '', batchSize: 0, timing: '', note: '' });

export function normalizeTrekBatches(raw, trekDate = null) {
    const out = [];
    if (Array.isArray(raw)) {
        raw.forEach((b) => {
            const date = String(b?.date || '').trim();
            const batchSize = Math.max(0, parseInt(b?.batchSize, 10) || 0);
            const timing = String(b?.timing || '').trim();
            const note = String(b?.note || '').trim();
            if (date || batchSize || timing || note) {
                out.push({ date, batchSize, timing, note });
            }
        });
    }
    if (!out.length && trekDate) {
        const d = new Date(trekDate);
        if (!Number.isNaN(d.getTime())) {
            out.push({
                date: d.toISOString().slice(0, 10),
                batchSize: 0,
                timing: '',
                note: '',
            });
        }
    }
    return out;
}

export function formatBatchDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return String(dateStr).trim();
}

/** Card subtitle — weekend, weekday, etc. (never trek dates) */
export function formatTrekCardDate(trek) {
    return (trek?.dateLabel || '').trim() || 'Date TBA';
}

/** Primary date for meta / SEO — first batch or legacy trekDate */
export function formatTrekDisplayDate(trek) {
    if (!trek) return '';
    const batches = normalizeTrekBatches(trek.trekBatches, trek.trekDate);
    if (batches[0]?.date) return formatBatchDate(batches[0].date);
    const raw = trek.trekDate;
    if (raw) {
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime())) {
            return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        }
    }
    return '';
}

export { EMPTY_BATCH };
