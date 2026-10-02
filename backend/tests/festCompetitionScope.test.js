/**
 * Competition-limited co-head access: page derivation and route/response scoping.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
    getCompetitionScope,
    pagesForCompetitionAccess,
    festRouteAllowedForOrganizer,
    publicOrganizerFields,
} = require('../src/utils/festOrganizerPages');
const { enforceCompetitionScope } = require('../src/middleware/festCompetitionScope');

const FEST = 'a'.repeat(24);
const OTHER_FEST = 'b'.repeat(24);
const COMP_A = '1'.repeat(24);
const COMP_B = '2'.repeat(24);
const COMP_C = '3'.repeat(24);

const organizer = {
    portalRole: 'cohead',
    allowedPages: ['coupons'],
    competitionAccess: [
        { festId: FEST, competitionId: COMP_A, sections: ['scanner'] },
        { festId: FEST, competitionId: COMP_B, sections: ['desk', 'revenue', 'participants'] },
        { festId: OTHER_FEST, competitionId: COMP_C, sections: ['scanner'] },
    ],
};

function run(req) {
    return new Promise((resolve) => {
        const res = {
            statusCode: 200,
            body: null,
            status(code) { this.statusCode = code; return this; },
            json(body) { this.body = body; resolve({ res: this, nexted: false }); return this; },
        };
        const full = { method: 'GET', body: {}, query: {}, organizer, festId: FEST, ...req };
        enforceCompetitionScope(full, res, () => resolve({ res, nexted: true, req: full }));
    });
}

test('pages derive from competition sections, ignoring stored allowedPages', () => {
    const fields = publicOrganizerFields(organizer);
    assert.deepEqual(
        new Set(fields.allowedPages),
        new Set(pagesForCompetitionAccess(organizer.competitionAccess)),
    );
    assert.ok(!fields.allowedPages.includes('coupons'));
    assert.equal(festRouteAllowedForOrganizer(organizer, 'GET', `/fests/${FEST}/coupons`), false);
    assert.equal(festRouteAllowedForOrganizer(organizer, 'POST', `/fests/${FEST}/checkin`), true);
});

test('scope is per fest and per section', () => {
    const scope = getCompetitionScope(organizer, FEST);
    assert.deepEqual([...scope.scanner], [COMP_A]);
    assert.deepEqual([...scope.desk], [COMP_B]);
    assert.ok(!scope.all.has(COMP_C));
    assert.equal(getCompetitionScope({ portalRole: 'organizer' }, FEST), null);
    assert.equal(getCompetitionScope({ portalRole: 'cohead', allowedPages: ['overview'] }, FEST), null);
});

test('scanner only accepts granted competitions', async () => {
    const ok = await run({ method: 'POST', path: `/fests/${FEST}/checkin`, body: { competitionId: COMP_A } });
    assert.equal(ok.nexted, true);
    const noComp = await run({ method: 'POST', path: `/fests/${FEST}/checkin`, body: {} });
    assert.equal(noComp.res.statusCode, 403);
    const wrong = await run({ method: 'POST', path: `/fests/${FEST}/checkin`, body: { competitionId: COMP_B } });
    assert.equal(wrong.res.statusCode, 403);
});

test('desk registrations and bundles need desk section on every competition', async () => {
    const reg = await run({ method: 'POST', path: `/fests/${FEST}/fest-day-desk/registrations`, body: { competitionId: COMP_B } });
    assert.equal(reg.nexted, true);
    const bundle = await run({
        method: 'POST',
        path: `/fests/${FEST}/fest-day-desk/bundles`,
        body: { items: [{ competitionId: COMP_B }, { competitionId: COMP_A }] },
    });
    assert.equal(bundle.res.statusCode, 403);
    const drafts = await run({ method: 'DELETE', path: `/fests/${FEST}/fest-day-desk/drafts` });
    assert.equal(drafts.res.statusCode, 403);
});

test('dashboard only shows granted competitions and hides money without revenue', async () => {
    const { res, nexted } = await run({ path: `/fests/${FEST}/dashboard` });
    assert.equal(nexted, true);
    res.json({
        success: true,
        stats: { revenue: 999999 },
        competitions: [
            { id: COMP_A, name: 'A', approved: 10, checkedIn: 4, revenue: 500, grossCollected: 520 },
            { id: COMP_B, name: 'B', approved: 5, checkedIn: 1, revenue: 300, grossCollected: 310 },
            { id: COMP_C, name: 'C', approved: 50, checkedIn: 0, revenue: 9000, grossCollected: 9100 },
        ],
        recent: [{ competitionName: 'A', amountPaid: 100 }, { competitionName: 'C', amountPaid: 50 }],
    });
    const body = res.body;
    assert.deepEqual(body.competitions.map((c) => c.name), ['A', 'B']);
    assert.equal(body.competitions[0].revenue, 0);
    assert.equal(body.stats.revenue, 300);
    assert.equal(body.stats.totalRegistrations, 15);
    assert.deepEqual(body.recent, [{ competitionName: 'A', amountPaid: 0 }]);
});

const AUD = '4'.repeat(24);
const gateOrganizer = {
    portalRole: 'cohead',
    competitionAccess: [
        { festId: FEST, competitionId: AUD, sections: ['gate', 'participants'], categories: ['first_year', 'second_year'] },
    ],
};
const runGate = (req) => run({ organizer: gateOrganizer, ...req });

test('gate grant only opens the auditorium scanner', () => {
    const fields = publicOrganizerFields(gateOrganizer);
    assert.deepEqual(fields.allowedPages, ['auditorium-gate']);
    assert.deepEqual(fields.competitionAccess[0].sections, ['gate']);
    const allowed = (method, path) => festRouteAllowedForOrganizer(gateOrganizer, method, `/fests/${FEST}${path}`);
    assert.equal(allowed('POST', '/checkin'), true);
    assert.equal(allowed('GET', '/auditorium/gate'), true);
    assert.equal(allowed('GET', '/auditorium/lookup'), true);
    assert.equal(allowed('GET', '/auditorium'), false);
    assert.equal(allowed('GET', '/auditorium/roster'), false);
    assert.equal(allowed('POST', '/auditorium/desk'), false);
    assert.equal(allowed('GET', '/participants'), false);
    assert.equal(allowed('GET', '/dashboard'), false);
    const scope = getCompetitionScope(gateOrganizer, FEST);
    assert.ok(!scope.all.has(AUD));
    assert.deepEqual([...scope.gateCategories.get(AUD)], ['first_year', 'second_year']);
});

test('gate check-in passes category limits and rejects other competitions', async () => {
    const ok = await runGate({ method: 'POST', path: `/fests/${FEST}/checkin`, body: { competitionId: AUD } });
    assert.equal(ok.nexted, true);
    assert.equal(ok.req.auditoriumGateOnly, true);
    assert.deepEqual(ok.req.auditoriumCategoryIds, ['first_year', 'second_year']);
    const other = await runGate({ method: 'POST', path: `/fests/${FEST}/checkin`, body: { competitionId: COMP_A } });
    assert.equal(other.res.statusCode, 403);
    const noGate = await run({ path: `/fests/${FEST}/auditorium/lookup` });
    assert.equal(noGate.res.statusCode, 403);
});

test('gate lookup hides passes outside granted categories', async () => {
    const hit = await runGate({ path: `/fests/${FEST}/auditorium/lookup` });
    hit.res.json({ success: true, ticket: { competitionId: AUD, categoryId: 'third_year' } });
    assert.equal(hit.res.statusCode, 404);
    assert.equal(hit.res.body.success, false);
    const mine = await runGate({ path: `/fests/${FEST}/auditorium/lookup` });
    mine.res.json({ success: true, ticket: { competitionId: AUD, categoryId: 'first_year' } });
    assert.equal(mine.res.body.ticket.categoryId, 'first_year');
});

test('gate info lists only granted categories', async () => {
    const { res } = await runGate({ path: `/fests/${FEST}/auditorium/gate` });
    res.json({
        success: true,
        competitionId: AUD,
        categories: [{ id: 'first_year' }, { id: 'second_year' }, { id: 'ex_core' }],
    });
    assert.deepEqual(res.body.categories.map((c) => c.id), ['first_year', 'second_year']);
});

test('participant list rejects competitions outside scope', async () => {
    const bad = await run({ path: `/fests/${FEST}/participants`, query: { competitionId: COMP_C } });
    assert.equal(bad.res.statusCode, 403);
    const good = await run({ path: `/fests/${FEST}/participants`, query: { competitionId: COMP_A } });
    assert.equal(good.nexted, true);
});
