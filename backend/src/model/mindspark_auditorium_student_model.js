'use strict';

const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  competitionId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  emailHash: { type: String, required: true },
  categoryId: { type: String, required: true, enum: ['first_year', 'second_year', 'third_year', 'fourth_year', 'mba'] },
  batchId: { type: String, required: true },
}, { timestamps: true });

schema.index({ competitionId: 1, emailHash: 1 }, { unique: true, name: 'auditorium_student_email' });
schema.index({ competitionId: 1, categoryId: 1 });

module.exports = mongoose.models.MindSparkAuditoriumStudent
  || mongoose.model('MindSparkAuditoriumStudent', schema);
