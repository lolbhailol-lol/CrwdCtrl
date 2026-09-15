const FIELD_TYPES = new Set(['text', 'email', 'tel', 'number', 'textarea', 'select', 'file', 'date']);

function sanitizeOptionCoupons(options, optionCoupons) {
    const allowed = new Set((Array.isArray(options) ? options : []).map((o) => String(o || '').trim()).filter(Boolean));
    const src = optionCoupons instanceof Map
        ? Object.fromEntries(optionCoupons)
        : (optionCoupons && typeof optionCoupons === 'object' ? optionCoupons : {});
    const out = {};
    for (const [key, val] of Object.entries(src)) {
        const label = String(key || '').trim();
        const code = String(val || '').trim().toUpperCase();
        if (!label || !code || !allowed.has(label)) continue;
        out[label] = code;
    }
    return out;
}

function sanitizeFormSchema(formSchema) {
    if (!Array.isArray(formSchema)) return [];
    return formSchema
        .filter((f) => f && (f.label || f.fieldName))
        .map((f) => {
            const options = Array.isArray(f.options)
                ? f.options.map((o) => String(o || '').trim()).filter(Boolean)
                : [];
            return {
                id: String(f.id || `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
                label: String(f.label || '').trim(),
                fieldName: String(f.fieldName || f.label || '')
                    .toLowerCase()
                    .trim()
                    .replace(/[^a-z0-9]+/g, '_')
                    .replace(/^_+|_+$/g, ''),
                type: FIELD_TYPES.has(f.type) ? f.type : 'text',
                required: Boolean(f.required),
                options,
                optionCoupons: sanitizeOptionCoupons(options, f.optionCoupons),
                placeholder: String(f.placeholder || '').trim(),
                bookingStep: (() => {
                    const step = Number(f.bookingStep);
                    if (!Number.isFinite(step) || step < 1) return 2;
                    return Math.min(10, Math.round(step));
                })(),
            };
        })
        .filter((f) => f.label && f.fieldName);
}

module.exports = {
    FIELD_TYPES,
    sanitizeOptionCoupons,
    sanitizeFormSchema,
};
