const test = require('node:test');
const assert = require('node:assert/strict');
const { createPublicListCache } = require('../src/utils/publicListCache');

test('100 simultaneous visitors share one database load', async () => {
    const cache = createPublicListCache();
    let calls = 0;
    const load = async () => { calls++; return { fests: ['fest'] }; };
    const results = await Promise.all(Array.from({ length: 100 }, () => cache.getOrLoad('all', load)));
    assert.equal(calls, 1);
    assert.ok(results.every(value => value === results[0]));
});

test('other searches cannot extend an entry expiry and capacity is bounded', async () => {
    let time = 0;
    const cache = createPublicListCache({ ttl: 10, maxEntries: 2, now: () => time });
    await cache.getOrLoad('a', () => 'old');
    time = 9;
    await cache.getOrLoad('b', () => 'b');
    time = 11;
    assert.equal(await cache.getOrLoad('a', () => 'fresh'), 'fresh');
    await cache.getOrLoad('c', () => 'c');
    assert.equal(await cache.getOrLoad('b', () => 'reloaded'), 'reloaded');
});

test('failed requests can retry', async () => {
    const cache = createPublicListCache();
    await assert.rejects(cache.getOrLoad('all', () => { throw new Error('offline'); }));
    assert.equal(await cache.getOrLoad('all', () => 'recovered'), 'recovered');
});

test('admin invalidation prevents an older request from repopulating the cache', async () => {
    const cache = createPublicListCache();
    let finish;
    const old = cache.getOrLoad('all', () => new Promise(resolve => { finish = resolve; }));
    await Promise.resolve();
    cache.clear();
    assert.equal(await cache.getOrLoad('all', () => 'new'), 'new');
    finish('old');
    await old;
    assert.equal(await cache.getOrLoad('all', () => 'unexpected'), 'new');
});
