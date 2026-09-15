const test = require('node:test');
const assert = require('node:assert/strict');

const {
    upcomingWeekdays,
    buildRollingWeekendBatches,
    isRecurringWeekendTrek,
    filterPastIsoDates,
    matchesTrekVedeCommunity,
    inferWeekdaysFromDateLabel,
} = require('../src/utils/trekWeekendDates');

test('upcomingWeekdays returns only future Sat dates', () => {
    const now = new Date('2026-08-23T12:00:00');
    const dates = upcomingWeekdays(6, 3, now);
    assert.equal(dates.length, 3);
    assert.equal(dates[0], '2026-08-29');
    assert.equal(dates[1], '2026-09-05');
    assert.equal(dates[2], '2026-09-12');
});

test('buildRollingWeekendBatches preserves timing per weekday', () => {
    const now = new Date('2026-08-23T12:00:00');
    const batches = buildRollingWeekendBatches([
        { date: '2026-08-22', timing: '05:00 AM', note: 'Sat/Sun', batchSize: 0 },
        { date: '2026-08-23', timing: '06:00 AM', note: 'Sun', batchSize: 0 },
    ], { weeks: 2, dateLabel: 'Every Saturday & Sunday' }, now);

    assert.ok(batches.length >= 4);
    const sat = batches.find((b) => b.date === '2026-08-29');
    const sun = batches.find((b) => b.date === '2026-08-23');
    assert.equal(sat?.timing, '05:00 AM');
    assert.equal(sun?.timing, '06:00 AM');
    assert.ok(!batches.some((b) => b.date === '2026-08-22'));
});

test('isRecurringWeekendTrek detects weekend labels', () => {
    assert.equal(isRecurringWeekendTrek({ dateLabel: 'Every Saturday & Sunday' }), true);
    assert.equal(isRecurringWeekendTrek({ dateLabel: 'Every Weekend (Fri–Sat | Sat–Sun)' }), true);
    assert.equal(isRecurringWeekendTrek({ dateLabel: '11 - 12 July' }), false);
});

test('filterPastIsoDates drops yesterday only', () => {
    const now = new Date('2026-08-23T12:00:00');
    const out = filterPastIsoDates(['2026-08-22', '2026-08-23', '2026-08-24'], now);
    assert.deepEqual(out, ['2026-08-23', '2026-08-24']);
});

test('inferWeekdaysFromDateLabel handles Fri-Sat overnight vs Sat-Sun day treks', () => {
    assert.deepEqual(
        inferWeekdaysFromDateLabel('Every Weekend (Fri–Sat | Sat–Sun)'),
        [5, 6],
    );
    assert.deepEqual(
        inferWeekdaysFromDateLabel('Every Saturday & Sunday'),
        [6, 0],
    );
});

test('matchesTrekVedeCommunity matches name and slug variants', () => {
    assert.equal(matchesTrekVedeCommunity({ name: 'TrekkVede' }), true);
    assert.equal(matchesTrekVedeCommunity({ slug: 'trekvede' }), true);
    assert.equal(matchesTrekVedeCommunity({ name: 'Other Club' }), false);
});
