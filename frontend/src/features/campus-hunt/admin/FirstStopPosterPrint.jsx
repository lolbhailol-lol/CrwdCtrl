import StationPosterPrint from './StationPosterPrint';
import { STAGE_THEMES } from '../types/stageTheme';

/** Clue 1 print: Orange shared station QRs for selected places. */
export default function FirstStopPosterPrint({
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
      theme={STAGE_THEMES.clue1}
      packsKey="firstStopPrintPacks"
      colorLabel="Orange"
      scanLabel="FIRST SCAN"
      title={placeCount
        ? `Clue 1 shared QRs · ${placeCount} place${placeCount === 1 ? '' : 's'}`
        : undefined}
      blurb={`One Orange FIRST SCAN QR per selected place. All ${teamSize} members at that spot scan the same poster, then enter their team code for their allotted clue.`}
      needMoreHint="Update Clue 1 for this setup (or Bootstrap), then refresh."
      skippedSummaryKey="skippedUnwanted"
      campusStations={campusStations}
      teamSize={teamSize}
    />
  );
}
