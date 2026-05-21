"use client";

import { SensorNode } from "@/types";

type NodeCardProps = {
  node: SensorNode;
};

const statusColors = {
  healthy: {
    badge: "bg-green-500/20 text-green-400",
    border: "border-green-500/30",
    value: "text-green-400",
  },
  warning: {
    badge: "bg-yellow-500/20 text-yellow-400",
    border: "border-yellow-500/30",
    value: "text-yellow-400",
  },
  alert: {
    badge: "bg-red-500/20 text-red-400",
    border: "border-red-500/30",
    value: "text-red-400",
  },
};

export default function NodeCard({ node }: NodeCardProps) {
  const colors = statusColors[node.status];

  return (
    <div
      className={`bg-gray-900 border ${colors.border} rounded-xl p-4 flex flex-col gap-3 hover:bg-gray-800/50 transition-colors`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white font-semibold text-sm">{node.name}</p>
          <p className="text-gray-500 text-xs">{node.location}</p>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${colors.badge}`}>
          {node.status.toUpperCase()}
        </span>
      </div>

      <div>
        <p className="text-gray-500 text-xs mb-0.5">Latest Event</p>
        <p className={`text-lg font-bold capitalize ${colors.value}`}>
          {node.latestEventClass ?? "—"}
        </p>
      </div>

      <div className="flex justify-between text-xs">
        <div>
          <p className="text-gray-500 mb-0.5">Peak Amplitude</p>
          <p className="text-white font-semibold">
            {node.peakAmplitude != null ? `${node.peakAmplitude.toFixed(2)} g` : "—"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-gray-500 mb-0.5">Confidence</p>
          <p className="text-white font-semibold">
            {node.confidence != null ? `${node.confidence}%` : "—"}
          </p>
        </div>
      </div>

      <p className="text-gray-600 text-xs">Last seen: {node.lastSeen}</p>
    </div>
  );
}
