const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePrn } = require('../src/utils/prnCode');

const OCT_2026 = new Date('2026-10-01T00:00:00+05:30');

test('decodes first-year and direct second-year examples', () => {
    const fy = parsePrn('2611001001', OCT_2026);
    assert.equal(fy.valid, true);
    assert.equal(fy.admissionYear, 2026);
    assert.equal(fy.entryType, 1);
    assert.equal(fy.branchName, 'Computer Engineering');
    assert.equal(fy.serial, '001');
    assert.equal(fy.categoryId, 'first_year');

    const dse = parsePrn('2621001001', OCT_2026);
    assert.equal(dse.valid, true);
    assert.equal(dse.entryLabel, 'Direct Second Year after Diploma');
    assert.equal(dse.categoryId, 'second_year');

    assert.equal(parsePrn('2311009125', OCT_2026).categoryId, 'fourth_year');
    assert.equal(parsePrn('2611001001', new Date('2027-03-01')).categoryId, 'first_year');
});

test('rejects malformed PRNs', () => {
    assert.equal(parsePrn('261100100', OCT_2026).valid, false);
    assert.match(parsePrn('2621001001x', OCT_2026).error, /10 digits/);
    assert.match(parsePrn('2631001001', OCT_2026).error, /Digits 3–4/);
    assert.equal(parsePrn('2612001001', OCT_2026).categoryId, 'second_year');
    assert.match(parsePrn('2611101001', OCT_2026).error, /common code/);
    assert.match(parsePrn('2611010001', OCT_2026).error, /branch/);
    assert.match(parsePrn('2611001000', OCT_2026).error, /Serial/);
    assert.match(parsePrn('2721001001', OCT_2026).error, /future/);
});
