"use client";

import { useState } from "react";
import { SensorEvent, NodeStatus } from "@/types";

type EventFeedProps = {
  events: SensorEvent[];
};

const levelColors: Record<NodeStatus, string> = {
  healthy: "text-green-400",
  warning: "text-yellow-400",
  alert: "text-red-400",
};

const nodeBadgeColors: Record<number, string> = {
  1: "bg-blue-500/20 text-blue-400",
  2: "bg-purple-500/20 text-purple-400",
  3: "bg-teal-500/20 text-teal-400",
  4: "bg-orange-500/20 text-orange-400",
};

export default function EventFeed({ events }: EventFeedProps) {
  const [filter, setFilter] = useState<NodeStatus | "all">("all");

  const filtered = filter === "all" ? events : events.filter((e) => e.level === filter);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-sm uppercase tracking-wide">
          Live Event Feed
        </h2>
        <div className="flex gap-1">
          {(["all", "alert", "warning", "healthy"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-2 py-1 rounded transition-colors cursor-pointer ${
                filter === f ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 overflow-y-auto max-h-64">
        {filtered.map((event) => (
          <div key={event.id} className="flex items-start gap-3 text-xs">
            <span className="text-gray-600 font-mono shrink-0">{event.timestamp}</span>
            <span className={`font-semibold shrink-0 ${levelColors[event.level]}`}>
              {event.nodeName}
            </span>
            <span className="text-gray-400">{event.message}</span>
            <span
              className={`ml-auto shrink-0 px-1.5 py-0.5 rounded text-xs ${nodeBadgeColors[event.nodeId] ?? "bg-gray-700 text-gray-400"}`}
            >
              Node {event.nodeId}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
