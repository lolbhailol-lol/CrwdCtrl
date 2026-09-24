const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_CAMPUS_STATIONS,
  DEFAULT_STATION_DIGIT_CODES,
} = require('../../src/modules/campus-hunt/services/stationCatalogService');
const {
  stationForLocalTeam,
  lockboxCodeForTeam,
  clue5WordForTeam,
} = require('../../src/modules/campus-hunt/services/round1BootstrapService');

const EXPECTED_NAMES = [
  'JET ENGINE', 'MATHEMATICS DEPARTMENT', 'ENTC BUILDING', 'METALLURGY DEPARTMENT',
  'BOAT CLUB CANTEEN', 'GEOLOGY MUSEUM', 'CHEMISTRY LAB', 'VISVESVARAYA STATUE',
  'BHAU INSTITUTE', 'FOUNTAIN', 'ENTC GARDEN', 'LIBRARY', 'OLD CSE BUILDING',
  'FAB LAB', 'ALUMNI ASSOCIATION', 'NCC', 'GATE 2', 'SUBWAY', 'XEROX CENTRE',
  'CIVIL DEPARTMENT',
];
const EXPECTED_CLUE2 = [
  '940', '932', '531', '651', '861', '872', '420', '663', '731', '710',
  '850', '765', '942', '864', '830', '953', '957', '421', '952', '874',
];
const EXPECTED_CLUE3 = [
  '9407', '3815', '7264', '1598', '6032', '8471', '2956', '4713', '5180', '0629',
  '7346', '1864', '2538', '6901', '8142', '3075', '4286', '1756', '8630', '5924',
];
const EXPECTED_CLUE5 = [
  'QUEST', 'BLAZE', 'SPARK', 'PRIDE', 'FLAME', 'CROWN', 'STORM', 'RIVER', 'NORTH', 'LIGHT',
  'BRAVE', 'FOCUS', 'PULSE', 'SWIFT', 'GLINT', 'FORGE', 'ECHO', 'VISTA', 'NOVA', 'DASH',
];

test('COEP final-sheet routes and answers stay aligned for all 20 teams', () => {
  assert.deepEqual(DEFAULT_CAMPUS_STATIONS.map((row) => row.name), EXPECTED_NAMES);
  for (let team = 1; team <= 20; team += 1) {
    const stops = Array.from({ length: 5 }, (_, offset) => (
      stationForLocalTeam(team, 0, DEFAULT_CAMPUS_STATIONS, offset, 20)
    ));
    assert.deepEqual(
      stops.map((row) => row.name),
      Array.from({ length: 5 }, (_, offset) => EXPECTED_NAMES[(team - 1 + offset) % 20]),
      `Team ${team} route`,
    );
    assert.equal(DEFAULT_STATION_DIGIT_CODES[stops[1].code], EXPECTED_CLUE2[team - 1]);
    assert.equal(lockboxCodeForTeam(0, team, 20), EXPECTED_CLUE3[team - 1]);
    assert.equal(clue5WordForTeam(0, team, 20), EXPECTED_CLUE5[team - 1]);
  }
});
