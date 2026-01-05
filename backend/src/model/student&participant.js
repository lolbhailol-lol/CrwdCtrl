const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Links to main User schema (role: 'student')
      required: true,
    },
    college: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String, // e.g., "Computer Science", "Mechanical Engineering"
    },
    yearOfStudy: {
      type: String, // e.g., "1st Year", "2nd Year"
    },
    regNumber: {
      type: String, // Optional college registration number
    },
    bio: {
      type: String, // Short intro or interest area
    },
    linkedin: {
      type: String, // Optional LinkedIn URL
    },
    leetcode: {
      type: String, // Optional LeetCode profile link
    },
    github: {
      type: String, // Optional GitHub profile link
    },
    registeredFests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FestOrganizer', // Fests the student registered for
      },
    ],
    registeredEvents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event', // Specific events under fests
      },
    ],
    registeredCompetitions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Competition', // Specific competitions
      },
    ],
    notifications: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Notification', // Alerts about registrations or updates
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Student', studentSchema);
