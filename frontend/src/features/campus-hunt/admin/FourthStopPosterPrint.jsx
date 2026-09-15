import StationPosterPrint from './StationPosterPrint';
import { STAGE_THEMES } from '../types/stageTheme';

/** Clue 4 / Checkpoint 4 print: purple shared FOURTH SCAN QRs for selected places. */
export default function FourthStopPosterPrint({
  eventId,
  reloadKey = 0,
  campusStations,
  stationCount = null,
  teamSize = 4,
}) {
  const placeCount = stationCount != null
    ? Number(stationCount)
    : (Array.isArray(campusStations) && campusStations.length
      ? campusStations.length
      : null);
  return (
    <StationPosterPrint
      eventId={eventId}
      reloadKey={reloadKey}
      theme={STAGE_THEMES.clue4}
      packsKey="fourthStopPrintPacks"
      colorLabel="Purple"
      scanLabel="FOURTH SCAN"
      title={placeCount
        ? `FOURTH SCAN shared QRs · ${placeCount} place${placeCount === 1 ? '' : 's'}`
        : undefined}
      blurb={`Small purple cards on one A3 cut sheet — tuck near the planted prop. Finding them early does nothing until after the prop hunt. One shared QR per selected place; after ${teamSize}/${teamSize} scans, teams enter their team code for Final.`}
      needMoreHint="Save setup or Update Clue 4 for this setup — shared QRs appear after either step."
      skippedSummaryKey="fourthSkipped"
      campusStations={campusStations}
      stationCount={stationCount}
      teamSize={teamSize}
      printLayout="a3-single"
    />
  );
}
