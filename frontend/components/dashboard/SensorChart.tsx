"use client";

import { useSocket } from "@/hooks/useSocket";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export default function SensorChart() {
  const { connected, history, sendCommand } = useSocket();

  const chartData = history.map((d, i) => ({
    time: `${i}`,
    peak: d.peak,
    rms: d.rms,
  }));

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-sm uppercase tracking-wide">Live Vibration</h2>
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-red-500"}`} />
          <button
            onClick={() => sendCommand("calibrate")}
            className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
          >
            Calibrate
          </button>
          <button
            onClick={() => sendCommand("reset")}
            className="text-xs px-3 py-1 bg-red-700 hover:bg-red-600 text-white rounded transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="time" tick={{ fill: "#6b7280", fontSize: 11 }} />
            <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111827",
                border: "1px solid #374151",
                borderRadius: "6px",
              }}
            />
            <Area type="monotone" dataKey="peak" stroke="#f87171" strokeWidth={2} fill="none" />
            <Area type="monotone" dataKey="rms" stroke="#3b82f6" strokeWidth={2} fill="none" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
