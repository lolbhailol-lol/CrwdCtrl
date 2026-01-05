import FestTable from './FestTable';

export default function FestsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Fest Management</h1>
        <p className="text-gray-400">Create, edit, and manage fests</p>
      </div>
      <FestTable />
    </div>
  );
}



