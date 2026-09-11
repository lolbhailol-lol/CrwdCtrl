const test = require('node:test');
const assert = require('node:assert/strict');

const { mergeUpdatedTeamMembers } = require('../src/utils/teamMemberMerge');

const person = (name, email) => ({ name, email, phone: '9999999999', college: 'College' });

test('adding a member preserves all previously saved teammates', () => {
  const lead = person('Lead', 'lead@example.com');
  const firstTeammate = person('First', 'first@example.com');
  const secondTeammate = person('Second', 'second@example.com');

  assert.deepEqual(
    mergeUpdatedTeamMembers({
      existingMembers: [lead, firstTeammate],
      lead,
      submittedMembers: [secondTeammate],
    }),
    [lead, firstTeammate, secondTeammate],
  );
});

test('repeating an add request does not create duplicate members', () => {
  const lead = person('Lead', 'lead@example.com');
  const teammate = person('Teammate', 'member@example.com');

  assert.deepEqual(
    mergeUpdatedTeamMembers({
      existingMembers: [lead, teammate],
      lead,
      submittedMembers: [{ ...teammate, email: ' MEMBER@example.com ' }],
    }),
    [lead, teammate],
  );
});

test('a full roster submission can still replace organizer-edited teammates', () => {
  const lead = person('Lead', 'lead@example.com');
  const oldTeammate = person('Old', 'old@example.com');
  const replacement = person('Replacement', 'new@example.com');

  assert.deepEqual(
    mergeUpdatedTeamMembers({
      existingMembers: [lead, oldTeammate],
      lead,
      submittedMembers: [{ ...lead }, replacement],
    }),
    [lead, replacement],
  );
});

test('legacy registration without an embedded roster keeps its response-derived lead', () => {
  const lead = person('Lead', 'lead@example.com');
  const teammate = person('Teammate', 'member@example.com');

  assert.deepEqual(
    mergeUpdatedTeamMembers({ existingMembers: [], lead, submittedMembers: [teammate] }),
    [lead, teammate],
  );
});
