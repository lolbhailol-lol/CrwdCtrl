/**
 * Register all Campus Hunt Mongoose models.
 */
function registerModels() {
  require('./CampusHuntEvent');
  require('./CampusHuntRound');
  require('./CampusHuntRoute');
  require('./CampusHuntStartingPoint');
  require('./CampusHuntTeam');
  require('./CampusHuntChallenge');
  require('./CampusHuntCheckpoint');
  require('./CampusHuntTeamProgress');
  require('./CampusHuntCheckpointVerification');
  require('./CampusHuntIssueReport');
  require('./CampusHuntAuditLog');
  require('./CampusHuntVolunteerAccess');
  require('./CampusHuntFinaleEntry');
  require('./CampusHuntFinaleMissionRun');
  require('./CampusHuntFinaleMissionConfig');
  require('./CampusHuntGridSession');
}

module.exports = {
  registerModels,
  CampusHuntEvent: () => require('./CampusHuntEvent'),
  CampusHuntRound: () => require('./CampusHuntRound'),
  CampusHuntRoute: () => require('./CampusHuntRoute'),
  CampusHuntStartingPoint: () => require('./CampusHuntStartingPoint'),
  CampusHuntTeam: () => require('./CampusHuntTeam'),
  CampusHuntChallenge: () => require('./CampusHuntChallenge'),
  CampusHuntCheckpoint: () => require('./CampusHuntCheckpoint'),
  CampusHuntTeamProgress: () => require('./CampusHuntTeamProgress'),
  CampusHuntCheckpointVerification: () => require('./CampusHuntCheckpointVerification'),
  CampusHuntIssueReport: () => require('./CampusHuntIssueReport'),
  CampusHuntAuditLog: () => require('./CampusHuntAuditLog'),
  CampusHuntVolunteerAccess: () => require('./CampusHuntVolunteerAccess'),
};
