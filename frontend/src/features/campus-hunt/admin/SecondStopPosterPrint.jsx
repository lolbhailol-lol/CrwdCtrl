import StationPosterPrint from './StationPosterPrint';
import { STAGE_THEMES } from '../types/stageTheme';

/** Clue 2 / Checkpoint 2 print: green shared SECOND SCAN QRs for selected places. */
export default function SecondStopPosterPrint({
  eventId,
  reloadKey = 0,
  campusStations,
  teamSize = 4,
}) {
  const placeCount = Array.isArray(campusStations) && campusStations.length
    ? campusStations.length
    : null;
  return (
    <StationPosterPrint
      eventId={eventId}
      reloadKey={reloadKey}
      theme={STAGE_THEMES.clue2}
      packsKey="secondStopPrintPacks"
      colorLabel="Green"
      scanLabel="SECOND SCAN"
      title={placeCount
        ? `SECOND SCAN shared QRs · ${placeCount} place${placeCount === 1 ? '' : 's'}`
        : undefined}
      blurb={`Small green cards — tuck anywhere. Finding them early does nothing until Clue 2. One shared QR per selected place; after ${teamSize}/${teamSize} scans, teams enter their team code for Clue 3.`}
      needMoreHint="Update Clue 2 for this setup + Save Clue 2, then refresh."
      skippedSummaryKey="secondSkipped"
      campusStations={campusStations}
      teamSize={teamSize}
    />
  );
}
