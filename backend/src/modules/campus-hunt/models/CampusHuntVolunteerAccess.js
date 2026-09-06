const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const campusHuntVolunteerAccessSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntEvent',
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    passwordHash: { type: String, required: true, select: false },
    label: { type: String, default: 'Volunteer', trim: true },
    checkpointIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CampusHuntCheckpoint' }],
      default: [],
    },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

campusHuntVolunteerAccessSchema.index({ eventId: 1, code: 1 }, { unique: true });

campusHuntVolunteerAccessSchema.methods.verifyPassword = async function verifyPassword(password) {
  return bcrypt.compare(String(password || ''), this.passwordHash);
};

campusHuntVolunteerAccessSchema.statics.hashPassword = async function hashPassword(password) {
  return bcrypt.hash(String(password), 10);
};

module.exports = mongoose.models.CampusHuntVolunteerAccess
  || mongoose.model('CampusHuntVolunteerAccess', campusHuntVolunteerAccessSchema);
