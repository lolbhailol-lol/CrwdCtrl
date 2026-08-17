import { useLayoutEffect, useState } from 'react';

/** Reactive mirror of a class on document.body (e.g. page-content-loading). */
export function useBodyHasClass(className) {
    const [active, setActive] = useState(() => (
        typeof document !== 'undefined' && document.body.classList.contains(className)
    ));

    useLayoutEffect(() => {
        const el = document.body;
        const sync = () => setActive(el.classList.contains(className));
        sync();
        const obs = new MutationObserver(sync);
        obs.observe(el, { attributes: true, attributeFilter: ['class'] });
        return () => obs.disconnect();
    }, [className]);

    return active;
}
