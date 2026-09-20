import FirstStopPosterPrint from './FirstStopPosterPrint';
import SecondStopPosterPrint from './SecondStopPosterPrint';
import ThirdStopPosterPrint from './ThirdStopPosterPrint';
import FourthStopPosterPrint from './FourthStopPosterPrint';
import FifthStopPosterPrint from './FifthStopPosterPrint';

/**
 * Print all shared stage QRs for the format:
 * 5 colors per campus place (orange→red), not per team.
 */
export default function PlacePosterPrint({
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
  const total = placeCount ? placeCount * 5 : null;

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-50">
        <p className="font-bold text-emerald-100">Plant 5 shared stage QRs per place</p>
        <p className="mt-1 text-[11px] text-emerald-50/80">
          Orange · green · blue · purple · red — not one QR per team.
          {' '}
          {total
            ? `About ${total} posters total (${placeCount} places × 5 stages).`
            : 'One set of 5 stage posters at each campus place.'}
          {' '}
          Phone already knows which stage; wrong color / wrong place is rejected.
        </p>
      </div>
      <FirstStopPosterPrint
        eventId={eventId}
        reloadKey={reloadKey}
        campusStations={campusStations}
        stationCount={stationCount}
        teamSize={teamSize}
      />
      <SecondStopPosterPrint
        eventId={eventId}
        reloadKey={reloadKey}
        campusStations={campusStations}
        stationCount={stationCount}
        teamSize={teamSize}
      />
      <ThirdStopPosterPrint
        eventId={eventId}
        reloadKey={reloadKey}
        campusStations={campusStations}
        stationCount={stationCount}
        teamSize={teamSize}
      />
      <FourthStopPosterPrint
        eventId={eventId}
        reloadKey={reloadKey}
        campusStations={campusStations}
        stationCount={stationCount}
        teamSize={teamSize}
      />
      <FifthStopPosterPrint
        eventId={eventId}
        reloadKey={reloadKey}
        campusStations={campusStations}
        stationCount={stationCount}
        teamSize={teamSize}
      />
    </section>
  );
}
