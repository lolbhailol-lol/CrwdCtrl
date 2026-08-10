import StationPosterPrint from './StationPosterPrint';
import { STAGE_THEMES } from '../types/stageTheme';

/** Clue 3 / Checkpoint 3 print: 10 blue shared THIRD SCAN QRs. */
export default function ThirdStopPosterPrint({ eventId, reloadKey = 0 }) {
  return (
    <StationPosterPrint
      eventId={eventId}
      reloadKey={reloadKey}
      theme={STAGE_THEMES.clue3}
      packsKey="thirdStopPrintPacks"
      colorLabel="Blue"
      scanLabel="THIRD SCAN"
      title="THIRD SCAN shared QRs · 10 total"
      blurb="Small blue cards — tuck anywhere. Finding them early does nothing until after Clue 3 riddle. One shared QR per place; after 4/4 scans, teams enter their team code for Final."
      needMoreHint="Bootstrap + Save Clue 3, then refresh."
      skippedSummaryKey="thirdSkipped"
    />
  );
}
