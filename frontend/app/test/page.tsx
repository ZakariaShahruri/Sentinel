"use client";

import { useEffect, useState } from "react";
import { getNodes, getEvents } from "@/service/api";
import { ApiNode, ApiEvent } from "@/types";

type EndpointResult<T> =
  | { status: "loading" }
  | { status: "ok"; data: T }
  | { status: "error"; message: string };

function ResultBlock<T>({ label, result }: { label: string; result: EndpointResult<T> }) {
  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="font-mono text-sm font-semibold text-white">{label}</span>
        {result.status === "loading" && (
          <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">loading…</span>
        )}
        {result.status === "ok" && (
          <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded">
            200 OK — {Array.isArray(result.data) ? `${result.data.length} items` : "1 item"}
          </span>
        )}
        {result.status === "error" && (
          <span className="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded">error</span>
        )}
      </div>

      {result.status === "error" && (
        <p className="text-red-400 text-sm font-mono">{result.message}</p>
      )}

      {result.status === "ok" && (
        <pre className="text-xs text-gray-300 overflow-x-auto max-h-64 overflow-y-auto">
          {JSON.stringify(result.data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function TestPage() {
  const [nodes, setNodes] = useState<EndpointResult<ApiNode[]>>({ status: "loading" });
  const [events, setEvents] = useState<EndpointResult<ApiEvent[]>>({ status: "loading" });

  const fetchAll = () => {
    getNodes()
      .then((data) => setNodes({ status: "ok", data }))
      .catch((e) => setNodes({ status: "error", message: e.message }));

    getEvents()
      .then((data) => setEvents({ status: "ok", data }))
      .catch((e) => setEvents({ status: "error", message: e.message }));
  };

  const runAll = () => {
    setNodes({ status: "loading" });
    setEvents({ status: "loading" });
    fetchAll();
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "(not set)";

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">API Test Page</h1>
        <p className="text-gray-400 text-sm mb-1">
          Base URL: <span className="font-mono text-blue-400">{apiUrl}</span>
        </p>
        <p className="text-gray-500 text-xs mb-6">
          Make sure your FastAPI backend is running at that address.
        </p>

        <button
          onClick={runAll}
          className="mb-8 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors"
        >
          Re-run all requests
        </button>

        <div className="flex flex-col gap-4">
          <ResultBlock label="GET /nodes" result={nodes} />
          <ResultBlock label="GET /events" result={events} />
        </div>
      </div>
    </div>
  );
}
