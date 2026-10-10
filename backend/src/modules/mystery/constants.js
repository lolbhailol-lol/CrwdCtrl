const EVENT_STATUS = {
  PENDING_APPROVAL: 'pending_approval',
  UPCOMING: 'upcoming',
  REGISTRATION_OPEN: 'registration_open',
  LIVE: 'live',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
};

const TEAM_MODE = { COMPETITIVE: 'competitive', PRACTICE: 'practice' };

const WORLD = { PHYSICAL: 'physical', DIGITAL: 'digital', HUMAN: 'human', LOGIC: 'logic' };

// Ground-truth — kabhi bhi player ko seedha nahi bheja jaata
const RELIABILITY = { RELIABLE: 'reliable', UNRELIABLE: 'unreliable', AMBIGUOUS: 'ambiguous' };

const UNLOCK_SOURCE = { QR: 'qr', BRANCH: 'branch', AUTO: 'auto', TRADE: 'trade' };

const EXCHANGE_STATUS = { OFFERED: 'offered', ACCEPTED: 'accepted', DECLINED: 'declined' };

const PROGRESS_STATUS = { ACTIVE: 'active', FINISHED: 'finished' };

module.exports = { EVENT_STATUS, TEAM_MODE, WORLD, RELIABILITY, UNLOCK_SOURCE, EXCHANGE_STATUS, PROGRESS_STATUS };