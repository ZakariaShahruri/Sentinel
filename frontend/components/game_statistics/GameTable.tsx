"use client";

import { useState } from "react";
import { Game, TiltReading } from "@/types";
import { getTilts, analyzeGame } from "@/service/api";

type Props = { games: Game[] };

const TILT_HEADERS = ["ID", "Node", "Seq #", "Node Timestamp", "X", "Y", "Z", "Received At"];

export default function GameTable({ games }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tilts, setTilts] = useState<TiltReading[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState("");
  const [analysisStreaming, setAnalysisStreaming] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  async function handleRowClick(gameId: number) {
    if (selectedId === gameId) {
      setSelectedId(null);
      setTilts([]);
      return;
    }
    setSelectedId(gameId);
    setLoading(true);
    setError(null);
    setTilts([]);
    try {
      setTilts(await getTilts(gameId));
    } catch {
      setError("Failed to load tilt readings.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyze(e: React.MouseEvent, gameId: number) {
    e.stopPropagation();
    setAnalyzingId(gameId);
    setAnalysis("");
    setAnalysisStreaming(true);
    setAnalysisError(null);
    try {
      await analyzeGame(gameId, (chunk) => {
        setAnalysis((prev) => prev + chunk);
      });
    } catch {
      setAnalysisError("Analysis failed.");
    } finally {
      setAnalysisStreaming(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-white font-semibold text-sm uppercase tracking-wide">Games</h2>
          <p className="text-gray-500 text-xs mt-0.5">Click a row to view its tilt readings</p>
        </div>

        {games.length === 0 ? (
          <p className="text-gray-600 text-sm p-4">No games recorded yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-gray-500 text-xs font-medium uppercase tracking-widest px-4 py-2">
                  ID
                </th>
                <th className="text-left text-gray-500 text-xs font-medium uppercase tracking-widest px-4 py-2">
                  End Reason
                </th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {games.map((game) => (
                <tr
                  key={game.id}
                  onClick={() => handleRowClick(game.id)}
                  className={`border-b border-gray-800/50 cursor-pointer transition-colors text-sm ${
                    selectedId === game.id ? "bg-gray-800" : "hover:bg-gray-800/50"
                  }`}
                >
                  <td className="px-4 py-3 text-white font-mono">#{game.id}</td>
                  <td className="px-4 py-3 text-gray-400 capitalize">{game.end_reason}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-4">
                      <button
                        onClick={(e) => handleAnalyze(e, game.id)}
                        className={`text-xs px-2 py-1 rounded transition-colors cursor-pointer ${
                          analyzingId === game.id
                            ? "text-blue-400 bg-blue-500/10"
                            : "text-gray-500 hover:text-blue-400 hover:bg-blue-500/10"
                        }`}
                      >
                        analyze
                      </button>
                      <span className="text-gray-500 text-xs">
                        {selectedId === game.id ? "▲ collapse" : "▼ expand"}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {analyzingId !== null && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <h2 className="text-white font-semibold text-sm uppercase tracking-wide">
                AI Analysis — Game #{analyzingId}
              </h2>
            </div>
            {analysisStreaming && <span className="text-gray-500 text-xs">Analyzing…</span>}
            {analysisError && <span className="text-red-400 text-xs">{analysisError}</span>}
          </div>

          <div className="p-4 min-h-20 max-h-96 overflow-y-auto">
            {analysis ? (
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                {analysis}
                {analysisStreaming && (
                  <span className="inline-block w-1.5 h-[1em] bg-gray-400 ml-0.5 translate-y-0.5 animate-pulse" />
                )}
              </p>
            ) : analysisStreaming ? (
              <p className="text-gray-600 text-sm">...</p>
            ) : null}
          </div>
        </div>
      )}

      {selectedId !== null && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-white font-semibold text-sm uppercase tracking-wide">
              Tilt Readings — Game #{selectedId}
            </h2>
            {loading && <span className="text-gray-500 text-xs">Loading…</span>}
            {error && <span className="text-red-400 text-xs">{error}</span>}
            {!loading && !error && (
              <span className="text-gray-500 text-xs">{tilts.length} readings</span>
            )}
          </div>

          {!loading && !error && tilts.length === 0 && (
            <p className="text-gray-600 text-sm p-4">No tilt readings for this game.</p>
          )}

          {tilts.length > 0 && (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-900">
                  <tr className="border-b border-gray-800">
                    {TILT_HEADERS.map((h) => (
                      <th
                        key={h}
                        className="text-left text-gray-500 font-medium uppercase tracking-widest px-4 py-2 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tilts.map((t) => (
                    <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-4 py-2 text-gray-400 font-mono">{t.id}</td>
                      <td className="px-4 py-2 text-gray-400 font-mono">{t.node_id}</td>
                      <td className="px-4 py-2 text-gray-400 font-mono">{t.sequence_num}</td>
                      <td className="px-4 py-2 text-gray-400 font-mono">{t.node_timestamp}</td>
                      <td className="px-4 py-2 text-blue-400 font-mono">
                        {t.lastx != null ? t.lastx.toFixed(3) : "—"}
                      </td>
                      <td className="px-4 py-2 text-purple-400 font-mono">
                        {t.lasty != null ? t.lasty.toFixed(3) : "—"}
                      </td>
                      <td className="px-4 py-2 text-teal-400 font-mono">
                        {t.lastz != null ? t.lastz.toFixed(3) : "—"}
                      </td>
                      <td className="px-4 py-2 text-gray-500 font-mono whitespace-nowrap">
                        {t.received_at}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
