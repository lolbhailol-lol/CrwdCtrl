/**
 * MindSpark fest customizations (CrwdCtrl).
 * Put fest-specific UI / form / gates here — not in shared fest registration.
 */
export {
  MINDSPARK_FEST_ID,
  isMindSparkFest,
} from './isMindSparkFest';

export {
  PERSON_FIELD_TYPES,
  DEFAULT_PERSON_FIELDS,
  normalizePersonField,
  normalizePersonFields,
  getPersonFields,
  emptyTeamMember,
  normalizeTeamMember,
  teamMemberMissingLabel,
  isTeamMemberComplete,
  TeamSizeSelect,
  RosterPersonStep,
  RosterFieldsEditor,
} from './rosterFormSystem';

export { default as MindSparkSuccessStep } from './MindSparkSuccessStep';
export { default as ResourceLinksEditor } from './ResourceLinksEditor';
export { default as MindSparkWhatsAppLinksAdmin } from './MindSparkWhatsAppLinksAdmin';
