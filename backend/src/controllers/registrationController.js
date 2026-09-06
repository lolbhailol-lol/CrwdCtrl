const { upload } = require('./registration/helpers');
const {
  submitCustomCompetitionRegistration,
  submitCompetitionRegistration,
  updateTeamMembers,
} = require('./registration/competitionRegistration');
const {
  submitRegistration,
  getFestRegistrations,
  updateRegistrationStatus,
} = require('./registration/festRegistration');
const {
  getUserRegistration,
  getUserRegistrations,
  getRegistrationDetails,
  getEventShowRegistrationDetails,
  getTrekBookingDetails,
  getPaymentInvoice,
  getTrekPaymentInvoice,
  getEventShowPaymentInvoice,
  testGoogleSheets,
  diagnoseGoogleSheets,
} = require('./registration/queries');
const {
  payAndRegisterFest,
  payAndRegister,
} = require('./registration/payments');
const { submitEventShowRegistration, payAndRegisterEventShow } = require('./registration/eventShowRegistration');

module.exports = {
  submitRegistration,
  submitCompetitionRegistration,
  submitCustomCompetitionRegistration,
  submitEventShowRegistration,
  payAndRegisterEventShow,
  payAndRegisterFest,
  payAndRegister,
  getUserRegistration,
  getFestRegistrations,
  updateRegistrationStatus,
  getUserRegistrations,
  getRegistrationDetails,
  getEventShowRegistrationDetails,
  getTrekBookingDetails,
  getPaymentInvoice,
  getTrekPaymentInvoice,
  getEventShowPaymentInvoice,
  testGoogleSheets,
  diagnoseGoogleSheets,
  upload,
  updateTeamMembers,
};
