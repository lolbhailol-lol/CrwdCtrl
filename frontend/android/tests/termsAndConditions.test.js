import assert from 'node:assert/strict';
import test from 'node:test';
import { groupTermsAndConditions, textareaToTerms, termsToTextarea } from '../src/utils/termsAndConditions.js';

const FLAT = [
  'Refund & Cancellation Policy',
  'Cancellations made more than 24 hours before the event are eligible for a partial refund after deduction of the applicable convenience fee. No refunds will be provided for cancellations made within 24 hours of the event.',
  'Badminton Equipment & Footwear',
  'Participants must bring their own badminton racket and non-marking sports shoes. Rackets and shoes may also be rented at the venue, subject to availability and applicable charges.',
  'Participant Responsibility',
  'Participants are responsible for their own health and safety while participating and attend the event at their own risk.',
  'Safety & Conduct',
  'Participants are expected to follow the instructions of the organisers and venue staff and maintain respectful conduct throughout the event.',
  'By registering for Touch Grass 05, you confirm that you have read, understood and agreed to the above Terms & Conditions.',
];

test('groups heading + body into main T&C points with nested sentences', () => {
  const grouped = groupTermsAndConditions(FLAT);
  assert.equal(grouped.length, 5);
  assert.equal(grouped[0].title, 'Refund & Cancellation Policy');
  assert.equal(grouped[0].bullets.length, 2);
  assert.equal(grouped[1].title, 'Badminton Equipment & Footwear');
  assert.equal(grouped[2].title, 'Participant Responsibility');
  assert.equal(grouped[3].title, 'Safety & Conduct');
  assert.equal(grouped[4].title, '');
  assert.match(grouped[4].details, /By registering/);
});

test('textarea round-trip keeps title and body in one block', () => {
  const text = termsToTextarea(FLAT);
  const saved = textareaToTerms(text);
  assert.equal(saved.length, 5);
  assert.match(saved[0], /^Refund & Cancellation Policy\nCancellations/);
});
