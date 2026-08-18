const test = require('node:test');
const assert = require('node:assert/strict');

const {
  formatParticipantSheetRow,
  formatParticipantDetail,
} = require('../src/utils/runClubOrganizerFormat');

const EVENT = {
  title: 'TouchGrass 05',
  registrationFee: 529,
  registration: {
    formSchema: [
      { fieldName: 'gender', label: 'You are', type: 'select' },
      { fieldName: 'cafe_drink', label: 'Post-Game Fuel at cafe Mokaroma', type: 'select' },
      { fieldName: 'badminton_level', label: 'How would you rate yourself as a badminton player?', type: 'select' },
    ],
  },
};

function sampleReg(overrides = {}) {
  return {
    _id: 'abc123',
    status: 'confirmed',
    paymentStatus: 'paid',
    amountPaid: 499,
    couponCode: 'TG05F',
    couponDiscount: 30,
    amountBeforeDiscount: 529,
    bookingPeople: 1,
    bookingDate: '2026-08-23',
    bookingTime: '3:00 PM',
    guestName: '',
    guestEmail: '',
    user: { name: 'Ava Shah', email: 'ava@example.com', phoneNumber: '9876543210' },
    responses: {
      full_name: 'Ava Shah',
      email: 'ava@example.com',
      contact_no: '9876543210',
      gender: 'Female',
      cafe_drink: 'Iced Latte',
      badminton_level: 'Amateur – Play casually with friends',
      people: 1,
      date: '2026-08-23',
      time: '3:00 PM',
      addOnSelected: false,
    },
    ...overrides,
  };
}

test('organizer row keeps gender, drink, skill, people and coupon', () => {
  const row = formatParticipantSheetRow(sampleReg(), EVENT);
  assert.equal(row.participantGender, 'Female');
  assert.equal(row.people, 1);
  assert.equal(row.couponCode, 'TG05F');
  assert.equal(row.amountPaid, 499);
  assert.equal(row.listAmount, 529);

  const byName = Object.fromEntries((row.registrationFields || []).map((f) => [f.fieldName, f]));
  assert.equal(byName.gender.value, 'Female');
  assert.equal(byName.cafe_drink.value, 'Iced Latte');
  assert.equal(byName.cafe_drink.label, 'Post-Game Fuel at cafe Mokaroma');
  assert.equal(byName.badminton_level.value, 'Amateur – Play casually with friends');
  assert.equal(byName.people, undefined);
  assert.equal(byName.addOnSelected, undefined);
});

test('organizer detail includes booking people and labeled form answers', () => {
  const detail = formatParticipantDetail(sampleReg({ bookingPeople: 3, amountPaid: 1497, amountBeforeDiscount: 1587, couponDiscount: 90 }), EVENT);
  assert.equal(detail.people, 3);
  assert.equal(detail.bookingDetails.people, 3);
  assert.equal(detail.participantGender, 'Female');
  const labels = (detail.registrationFields || []).map((f) => f.label);
  assert.ok(labels.includes('Post-Game Fuel at cafe Mokaroma'));
  assert.ok(labels.includes('How would you rate yourself as a badminton player?'));
});
