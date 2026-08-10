import StationPosterPrint from './StationPosterPrint';
import { STAGE_THEMES } from '../types/stageTheme';

/** Clue 2 / Checkpoint 2 print: 10 green shared SECOND SCAN QRs. */
export default function SecondStopPosterPrint({ eventId, reloadKey = 0 }) {
  return (
    <StationPosterPrint
      eventId={eventId}
      reloadKey={reloadKey}
      theme={STAGE_THEMES.clue2}
      packsKey="secondStopPrintPacks"
      colorLabel="Green"
      scanLabel="SECOND SCAN"
      title="SECOND SCAN shared QRs · 10 total"
      blurb="Small green cards — tuck anywhere. Finding them early does nothing until Clue 2. One shared QR per place; after 4/4 scans, teams enter their team code for Clue 3."
      needMoreHint="Bootstrap + Save Clue 2, then refresh."
      skippedSummaryKey="secondSkipped"
    />
  );
}
