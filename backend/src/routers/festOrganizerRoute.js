const express = require('express');
const router = express.Router();
const festOrganizerController = require('../controllers/festOrganizerController');
const { authenticateToken, authorizeRoles } = require('../middleware/authmiddleware');

// Apply auth + organizer role to all fest-organizer routes
router.use(authenticateToken);
router.use(authorizeRoles('organizer'));

// ✅ Create a new fest
router.post('/create', festOrganizerController.createFest);

// ✅ Get all fests by logged-in organizer
router.get('/my-fests', festOrganizerController.getMyFests);

// ✅ Get fest statistics for organizer
router.get('/stats', festOrganizerController.getFestStats);

// ✅ Update fest details
router.put('/:id', festOrganizerController.updateFest);

// ✅ Delete fest
router.delete('/:id', festOrganizerController.deleteFest);

// ✅ Get single fest details
router.get('/:id', festOrganizerController.getFestById);

// ✅ Event management routes
router.post('/:id/events', festOrganizerController.addEventToFest);
router.delete('/:id/events', festOrganizerController.removeEventFromFest);

// ✅ Competition management routes
router.post('/:id/competitions', festOrganizerController.addCompetitionToFest);
router.delete('/:id/competitions', festOrganizerController.removeCompetitionFromFest);

// ✅ Create and manage individual events
router.post('/:festId/create-event', festOrganizerController.createEvent);
router.get('/:festId/events', festOrganizerController.getFestEvents);
router.put('/events/:eventId', festOrganizerController.updateEvent);
router.delete('/events/:eventId', festOrganizerController.deleteEvent);

// ✅ Create and manage individual competitions
router.post('/:festId/create-competition', festOrganizerController.createCompetition);
router.get('/:festId/competitions', festOrganizerController.getFestCompetitions);
router.put('/competitions/:competitionId', festOrganizerController.updateCompetition);
router.delete('/competitions/:competitionId', festOrganizerController.deleteCompetition);



module.exports = router;