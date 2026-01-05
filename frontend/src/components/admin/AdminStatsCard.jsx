import StatsCard from './StatsCard';

export default function AdminStats({ stats = {} }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
      <StatsCard label="Total Users" value={stats.totalUsers || 0} />
      <StatsCard label="Total Fests" value={stats.totalFests || 0} />
      <StatsCard label="Total Competitions" value={stats.totalCompetitions || 0} />
      <StatsCard label="Ongoing Fests" value={stats.ongoingFests || 0} />
      <StatsCard label="Upcoming Fests" value={stats.upcomingFests || 0} />
    </div>
  );
}
