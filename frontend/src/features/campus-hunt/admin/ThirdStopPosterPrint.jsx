import StationPosterPrint from './StationPosterPrint';
import { STAGE_THEMES } from '../types/stageTheme';

/** Clue 3 / Checkpoint 3 print: blue shared THIRD SCAN QRs for selected places. */
export default function ThirdStopPosterPrint({
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
      theme={STAGE_THEMES.clue3}
      packsKey="thirdStopPrintPacks"
      colorLabel="Blue"
      scanLabel="THIRD SCAN"
      title={placeCount
        ? `THIRD SCAN shared QRs · ${placeCount} place${placeCount === 1 ? '' : 's'}`
        : undefined}
      blurb={`Small blue cards — tuck anywhere. Finding them early does nothing until after Clue 3 riddle. One shared QR per selected place; after ${teamSize}/${teamSize} scans, teams enter their team code for the prop hunt.`}
      needMoreHint="Update Clue 3 for this setup + Save Clue 3, then refresh."
      skippedSummaryKey="thirdSkipped"
      campusStations={campusStations}
      teamSize={teamSize}
    />
  );
}
