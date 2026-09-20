import StationPosterPrint from './StationPosterPrint';
import { STAGE_THEMES } from '../types/stageTheme';

/** Clue 5 / Checkpoint 5 print: red shared FIFTH SCAN QRs for selected places. */
export default function FifthStopPosterPrint({
  eventId,
  reloadKey = 0,
  campusStations,
  stationCount = null,
  teamSize = 10,
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
      theme={STAGE_THEMES.final}
      packsKey="fifthStopPrintPacks"
      colorLabel="Red"
      scanLabel="FIFTH SCAN"
      title={placeCount
        ? `FIFTH SCAN shared QRs · ${placeCount} place${placeCount === 1 ? '' : 's'}`
        : undefined}
      blurb={`Small red cards on one A3 cut sheet — plant after Clue 5 word is solved. One shared QR per place; leader scans once, then enters team code for Clue 6 (destination).`}
      needMoreHint="Save setup / Generate schedule first — fifth-stop shared QRs appear after stations exist."
      skippedSummaryKey="fifthSkipped"
      campusStations={campusStations}
      stationCount={stationCount}
      teamSize={teamSize}
      printLayout="a3-single"
    />
  );
}
