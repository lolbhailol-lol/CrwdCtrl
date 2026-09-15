import StationPosterPrint from './StationPosterPrint';
import { STAGE_THEMES } from '../types/stageTheme';

/**
 * Primary plant print for offline Round 1:
 * ONE shared QR per campus place (not per team, not 4 colors).
 * Uses progression-1 station packs — phone already knows the stage.
 */
export default function PlacePosterPrint({
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
    <section className="space-y-2">
      <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-50">
        <p className="font-bold text-emerald-100">Plant only these — 1 QR per place</p>
        <p className="mt-1 text-[11px] text-emerald-50/80">
          Not one QR per team. Not four colors at each stop.
          {' '}
          {placeCount
            ? `Tape ${placeCount} poster${placeCount === 1 ? '' : 's'} total (one at each campus place).`
            : 'Tape one poster at each campus place.'}
          {' '}
          Leader phone already knows orange/green/blue/purple stage after the join word.
        </p>
      </div>
      <StationPosterPrint
        eventId={eventId}
        reloadKey={reloadKey}
        theme={STAGE_THEMES.clue1}
        packsKey="firstStopPrintPacks"
        colorLabel="Place"
        scanLabel="PLACE SCAN"
        title={placeCount
          ? `Place QRs · ${placeCount} campus stop${placeCount === 1 ? '' : 's'}`
          : 'Place QRs · one per campus stop'}
        blurb={`One shared QR per place on one A3 cut sheet. All teams that visit that stop scan the same poster (after joining the word). ${teamSize} people walk together — only the leader phone scans once.`}
        needMoreHint="Save setup / Update Clue 1 first — place QRs appear after shared stations exist."
        skippedSummaryKey="skippedUnwanted"
        campusStations={campusStations}
        stationCount={stationCount}
        teamSize={teamSize}
        printLayout="a3-single"
      />
    </section>
  );
}
