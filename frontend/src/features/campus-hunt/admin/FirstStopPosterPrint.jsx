import StationPosterPrint from './StationPosterPrint';
import { STAGE_THEMES } from '../types/stageTheme';

/** Clue 1 print: 10 Orange shared station QRs (one per place). */
export default function FirstStopPosterPrint({ eventId, reloadKey = 0 }) {
  return (
    <StationPosterPrint
      eventId={eventId}
      reloadKey={reloadKey}
      theme={STAGE_THEMES.clue1}
      packsKey="firstStopPrintPacks"
      colorLabel="Orange"
      scanLabel="FIRST SCAN"
      title={`Clue 1 shared QRs · 10 places`}
      blurb="One Orange FIRST SCAN QR per place. All teams at that spot scan the same poster, then enter their team code for their allotted clue."
      needMoreHint="re-bootstrap Round 1 station QRs, then refresh."
      skippedSummaryKey="skippedUnwanted"
    />
  );
}
