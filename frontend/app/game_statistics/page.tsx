import { cookies } from "next/headers";
import Sidebar from "@/components/dashboard/Sidebar";
import GameTable from "@/components/game_statistics/GameTable";
import { getGames } from "@/service/api";

export default async function GameStatisticsPage() {
  const token = (await cookies()).get("access_token")?.value;
  const games = await getGames(token).catch(() => []);

  return (
    <div className="flex min-h-screen bg-gray-950 text-white">
      <Sidebar />

      <div className="flex flex-col flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-widest">
            Game Statistics
          </p>
          <GameTable games={games} />
        </main>
      </div>
    </div>
  );
}
