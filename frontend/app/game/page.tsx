import Sidebar from "@/components/dashboard/Sidebar";
import MarbleGame from "@/components/game/MarbleGame";

export default function GamePage() {
  return (
    <div className="flex min-h-screen bg-gray-950 text-white">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex-1 p-6 flex flex-col">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-widest mb-4">
            Marble Game
          </p>
          <div className="flex-1 rounded-xl overflow-hidden border border-gray-800">
            <MarbleGame />
          </div>
        </div>
      </div>
    </div>
  );
}
