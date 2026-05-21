import { ApiEvent, ApiNode, ChartDataPoint, NodeStatus, SensorEvent, SensorNode } from "@/types";

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function nodeStatus(lastSeen: string | null): NodeStatus {
  if (!lastSeen) return "alert";
  const diff = (Date.now() - new Date(lastSeen).getTime()) / 1000;
  if (diff > 30) return "alert";
  if (diff > 10) return "warning";
  return "healthy";
}

function classToLevel(eventClass: string): NodeStatus {
  if (eventClass === "attack") return "alert";
  if (eventClass === "defense") return "warning";
  return "healthy";
}

function eventMessage(e: ApiEvent): string {
  const cls = e.event_class.charAt(0).toUpperCase() + e.event_class.slice(1);
  return `${cls} detected - amplitude ${e.peak_amplitude?.toFixed(2) ?? "?"} g, confidence ${e.confidence ?? "?"}%`;
}

export function mapNodes(apiNodes: ApiNode[], apiEvents: ApiEvent[]): SensorNode[] {
  return apiNodes.map((node) => {
    const latest = apiEvents
      .filter((e) => e.node_id === node.node_id)
      .sort(
        (a, b) => new Date(b.received_at ?? 0).getTime() - new Date(a.received_at ?? 0).getTime()
      )[0];

    return {
      id: node.node_id,
      name: `Node ${node.node_id}`,
      location: node.location ?? "Unknown",
      status: nodeStatus(node.last_seen),
      lastSeen: relativeTime(node.last_seen),
      latestEventClass: latest?.event_class ?? null,
      peakAmplitude: latest?.peak_amplitude ?? null,
      confidence: latest?.confidence ?? null,
    };
  });
}

export function mapEvents(apiEvents: ApiEvent[]): SensorEvent[] {
  return apiEvents.map((e) => ({
    id: e.id,
    timestamp: new Date(e.received_at ?? Date.now()).toLocaleTimeString("en-GB"),
    nodeId: e.node_id ?? 0,
    nodeName: `Node ${e.node_id}`,
    message: eventMessage(e),
    level: classToLevel(e.event_class),
  }));
}

export function mapChartData(apiEvents: ApiEvent[]): ChartDataPoint[] {
  return [...apiEvents]
    .sort((a, b) => new Date(a.received_at ?? 0).getTime() - new Date(b.received_at ?? 0).getTime())
    .slice(-20)
    .map((e) => ({
      time: new Date(e.received_at ?? Date.now()).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      db: e.peak_amplitude ?? 0,
    }));
}
