/**
 * MindSpark '26 schedule (SCHEDULING MS26). Day: 1 | 2 | 'both' | 'before'.
 * `tentative` = classroom or timing may still change.
 */
const R = (round, venue, time, day, extra = {}) => ({ round, venue, time, day, ...extra });

export const MINDSPARK_SCHEDULE = [
  { module: 'Opening', events: [
    { name: 'Inauguration', rounds: [R('Ceremony', 'Main Audi', '10:00 – 1:00', 1)] },
  ] },
  { module: 'Amuzia', events: [
    { name: 'FLASH', rounds: [R('All rounds', 'South & North Campus', 'Timing to be announced', null)] },
  ] },
  { module: 'Avionica', events: [
    { name: 'TAKE OFF', rounds: [R('Round 1', 'College Ground', '11:00 AM – 5:30 PM', 1)] },
    { name: 'TORQUEST', rounds: [R('Round 1', 'SC11, SC12', '9:00 – 11:00', 2), R('Round 2', 'SC11', '12:00 – 1:00', 2)] },
  ] },
  { module: 'Codifica', events: [
    { name: 'CODE JUNKIE', rounds: [R('Round 1', 'NC 05, 06, 07, 08', '11:00 – 2:00', 1), R('Round 2', 'NC13', '5:00 – 7:00', 1)] },
    { name: 'WEBSCAPE', rounds: [R('Round 1', 'NC09, NC10', '10:00 – 12:00', 1), R('Round 2', 'FOSS Lab', '8:30 – 11:30', 2)] },
    { name: 'NEURAL NEXUS', rounds: [R('Round 1', 'NC11, 12, 13', '1:00 – 3:00', 1), R('Round 2', 'ExTC Internet Lab', '11:30 – 1:30', 2)] },
  ] },
  { module: 'Hackathon', events: [
    { name: 'HACKATHON', rounds: [
      R('Inauguration', 'Cognizant Lab', '12:00 – 1:00', 1),
      R('Hackathon + Presentation', 'Cognizant Lab', '1:30 (Day 1) – 1:30 (Day 2)', 'both'),
    ] },
  ] },
  { module: 'Quantumania', events: [
    { name: 'QUANTQUEST', rounds: [R('Round 1', 'NC-23', '10:00 – 12:00', 1, { tentative: true }), R('Round 2', 'NC-23', '2:00 – 4:00', 1, { tentative: true })] },
  ] },
  { module: 'Illuminati', events: [
    { name: 'WORLD-WIZE', rounds: [R('Round 1', 'NC17', '12:00 – 2:00', 1), R('Round 2', 'NC18', '5:00 – 7:00', 1)] },
  ] },
  { module: 'Logica', events: [
    { name: 'MATHLETICS', rounds: [R('Round 1', 'CDH-1 and 2', '9:00 – 11:00', 1), R('Round 2', 'NC18', '3:00 – 5:00', 1)] },
  ] },
  { module: 'Designova', events: [
    { name: 'FUSION ID', rounds: [R('Round 1', 'Online', 'Before MindSpark', 'before'), R('Round 2', 'SC11', '12:00 – 2:00', 1)] },
    { name: 'REVIT RUSH', rounds: [R('Round 1', 'SC11', '10:30 – 12:00', 1), R('Round 2', 'SC11', '2:30 – 4:30', 1)] },
  ] },
  { module: 'Potentia', events: [
    { name: 'ASSEMBLIX', rounds: [R('Round 1', 'NC17', '3:00 – 5:00', 1), R('Round 2', 'NC18', '10:00 – 12:00', 2)] },
  ] },
  { module: 'Prodigium', events: [
    { name: 'GOOGLER', rounds: [R('Round 1', 'FOSS Lab', '9:00 – 3:00', 1, { tentative: true }), R('Round 2', 'FOSS Lab', '12:00 – 2:00', 2, { tentative: true })] },
    { name: 'SHERLOCKED', rounds: [R('Round 1', 'NC09 & NC10', '1:00 – 6:00', 1), R('Round 2', 'NC17', '8:30 – 11:00', 2), R('Round 3', 'Full Campus', '11:30 – 2:30', 2)] },
  ] },
  { module: 'Fan-Frenzy', events: [
    { name: 'BEYOND SUITS', rounds: [R('Round 1', 'NC21', '10:00 – 12:00', 1), R('Round 2', 'NC21', '2:00 – 4:00', 1)] },
    { name: 'FANDOM', rounds: [R('Round 1', 'CDH-1 and 2', '2:00 – 5:00', 1), R('Round 2', 'CDH-1', '10:00 – 2:00', 2)] },
  ] },
  { module: 'Struktura', events: [
    { name: 'UTOPIA', rounds: [R('Round 1', 'Seminar Hall 1', '9:00 – 3:00', 1)] },
    { name: 'EDIFEX', rounds: [R('Round 1', 'Civil Room 7', '3:00 – 5:00', 1), R('Round 2', 'Seminar Hall 1', '9:00 – 2:00', 2)] },
  ] },
  { module: 'Substantia', events: [
    { name: 'ON THE ETCH', rounds: [R('Round 1', 'MM-001', '11:00 – 1:00', 1), R('Round 2', 'MM-001', '2:00 – 4:00', 1)] },
  ] },
  { module: 'Voltus', events: [
    { name: 'MICROAPPS', rounds: [R('Round 1', 'NC-22', '4:00 – 6:00', 1), R('Round 2', 'EE Analog Lab', '12:00 – 3:00', 2)] },
    { name: 'CIRCUIT FIXER', rounds: [R('Round 1', 'NC-22', '10:00 – 12:00', 1), R('Round 2', 'EE Analog Lab', '9:00 – 12:00', 2)] },
    { name: 'FOX HUNT', rounds: [R('Round 1', 'ENTC Seminar Hall 2', '11:30 onwards', 1), R('Round 2', 'Whole Campus', 'All day', 1)] },
  ] },
  { module: 'Robotics', events: [
    'ROBO-ROYALE', 'ROBOWARS', "SEARCH N' DESTROY", 'ROBOSOCCER', 'ROBORACES', 'ROBO FALCONARY', 'BOT WRESTLING',
  ].map((name) => ({ name, rounds: [R('All rounds', 'Parking', 'All days', 'both')] })).concat([
    { name: 'VIRTUAL ROBOTICS', rounds: [R('Round 1', 'NC 20', '3:00 – 5:00', 1)] },
  ]) },
  { module: 'Ideathon', events: [
    { name: 'IDEATHON', rounds: [R('Round 1', 'Online', 'Before MindSpark', 'before'), R('Round 2', 'NC-14', '1:00 – 5:00', 1)] },
  ] },
  { module: 'Genius Junior', events: [
    { name: 'GENIUS JUNIOR', rounds: [R('Round 2', 'Main Audi', '9:00 – 12:00', 2), R('Round 3', 'Main Audi', '1:00 – 3:00', 2)] },
  ] },
  { module: 'Tech Expo', events: [
    { name: 'GAME OF INNOVATION', rounds: [R('Expo', 'AC Ground Floor Open Space', 'Day 1 & Day 2', 'both')] },
  ] },
];

export const SCHEDULE_DAY_META = {
  1: { label: 'Day 1', dark: 'bg-amber-400/15 text-amber-200 border-amber-400/30', light: 'bg-amber-50 text-amber-800 border-amber-200' },
  2: { label: 'Day 2', dark: 'bg-emerald-400/15 text-emerald-200 border-emerald-400/30', light: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  both: { label: 'Both days', dark: 'bg-orange-400/15 text-orange-200 border-orange-400/30', light: 'bg-orange-50 text-orange-800 border-orange-200' },
  before: { label: 'Before fest', dark: 'bg-sky-400/15 text-sky-200 border-sky-400/30', light: 'bg-sky-50 text-sky-800 border-sky-200' },
};
