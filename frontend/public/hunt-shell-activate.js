/* Hunt install: when a new shell activates, reload offline Hunt tabs once.
   Old precache was painting “everyone scans / 1 of 6” on a fresh pack. */
const HUNT_SHELL_RELOAD_FLAG = 'crwdctrl-hunt-shell-reload-v14';

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    let already = false;
    try {
      const cache = await caches.open(HUNT_SHELL_RELOAD_FLAG);
      already = Boolean(await cache.match('/done'));
      if (!already) {
        await cache.put('/done', new Response('1'));
      }
    } catch { /* ignore */ }
    if (already) return;

    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(windows.map(async (client) => {
      let path = '';
      try {
        path = new URL(client.url).pathname || '';
      } catch {
        return;
      }
      if (!path.startsWith('/campus-hunt/offline')) return;
      try {
        await client.navigate(client.url);
      } catch { /* ignore */ }
    }));
  })());
});
