// Bounded per-process cache for non-sensitive public discovery responses.
function createPublicListCache({ ttl = 45000, maxEntries = 128, now = Date.now } = {}) {
    const entries = new Map();
    const pending = new Map();
    let generation = 0;
    return {
        async getOrLoad(key, load) {
            const hit = entries.get(key);
            if (hit && hit.expires > now()) return hit.value;
            entries.delete(key);
            if (pending.has(key)) return pending.get(key);
            const version = generation;
            const request = Promise.resolve().then(load).then(value => {
                if (version === generation) {
                    for (const [entryKey, entry] of entries) {
                        if (entry.expires <= now()) entries.delete(entryKey);
                    }
                    if (entries.size >= maxEntries) entries.delete(entries.keys().next().value);
                    entries.set(key, { value, expires: now() + ttl });
                }
                return value;
            }).finally(() => {
                if (pending.get(key) === request) pending.delete(key);
            });
            pending.set(key, request);
            return request;
        },
        clear() {
            generation += 1;
            entries.clear();
            pending.clear();
        },
    };
}

module.exports = { createPublicListCache };
