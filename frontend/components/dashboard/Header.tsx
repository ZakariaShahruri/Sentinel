"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LiveClock from "./LiveClock";

type HeaderProps = {
  systemOnline: boolean;
  nodesOnline: number;
  totalNodes: number;
  uptime: string;
};

export default function Header({ systemOnline, nodesOnline, totalNodes, uptime }: HeaderProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  function handleLogout() {
    setLoggingOut(true);
    document.cookie = "access_token=; path=/; max-age=0; samesite=lax";
    document.cookie = "token=; path=/; max-age=0; samesite=lax";
    document.cookie = "user_role=; path=/; max-age=0; samesite=lax";
    router.replace("/login");
  }

  return (
    <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${systemOnline ? "bg-green-400" : "bg-red-500"}`}
          />
          <span
            className={`text-sm font-semibold ${systemOnline ? "text-green-400" : "text-red-400"}`}
          >
            {systemOnline ? "ONLINE" : "OFFLINE"}
          </span>
        </div>

        <div className="w-px h-4 bg-gray-700" />

        <div className="flex flex-col">
          <span className="text-gray-500 text-xs">Nodes Online</span>
          <span className="text-white font-semibold text-sm">
            {nodesOnline} / {totalNodes}
          </span>
        </div>

        <div className="w-px h-4 bg-gray-700" />

        <div className="flex flex-col">
          <span className="text-gray-500 text-xs">Active Alerts</span>
        </div>

        <div className="w-px h-4 bg-gray-700" />

        <div className="flex flex-col">
          <span className="text-gray-500 text-xs">Uptime</span>
          <span className="text-white font-semibold text-sm">{uptime}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <LiveClock />

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="rounded-xl border border-gray-700 bg-gray-800/70 px-4 py-2 text-sm font-semibold text-gray-100 transition-colors hover:border-red-500/60 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </header>
  );
}
