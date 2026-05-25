export type NodeStatus = "healthy" | "warning" | "alert";

export type SensorNode = {
  id: number;
  name: string;
  location: string;
  status: NodeStatus;
  lastSeen: string;
  latestEventClass: string | null;
  peakAmplitude: number | null;
  confidence: number | null;
};

export type SensorEvent = {
  id: number;
  timestamp: string;
  nodeId: number;
  nodeName: string;
  message: string;
  level: NodeStatus;
};

export type ChartDataPoint = {
  time: string;
  db: number;
};

export type ServiceStatus = {
  name: string;
  connected: boolean;
};

export type ApiNode = {
  node_id: number;
  location: string | null;
  last_seen: string | null;
  registered_at: string | null;
};

export type ApiEvent = {
  id: number;
  node_id: number | null;
  event_class: "attack" | "defense" | "background";
  confidence: number | null;
  received_at: string | null;
  sequence_num: number;
  peak_amplitude: number | null;
  rms_energy: number | null;
  zcr: number | null;
  decay_ms: number | null;
  node_timestamp: number;
  lastx: number | null;
  lasty: number | null;
  lastz: number | null;
};

export type Game = {
  id: number;
  user_id: number;
  end_reason: string;
};

export type TiltReading = {
  id: number;
  node_id: number;
  game_id: number;
  sequence_num: number;
  node_timestamp: number;
  lastx: number | null;
  lasty: number | null;
  lastz: number | null;
  received_at: string;
};
