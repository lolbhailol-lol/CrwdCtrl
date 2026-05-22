export default function StatsCard({ label, value }) {
  return (
    <div className="bg-[#111213] rounded-xl p-6 w-52 text-center shadow-lg">
      <div className="w-24 h-24 mx-auto rounded-full border-4 border-[#0ECCEE] flex items-center justify-center text-3xl font-bold">
        {value}
      </div>
      <p className="mt-4 text-gray-300 font-medium">{label}</p>
    </div>
  );
}
