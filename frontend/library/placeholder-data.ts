import { ServiceStatus } from "@/types";

export const services: ServiceStatus[] = [
  { name: "MQTT Broker", connected: true },
  { name: "WebSocket", connected: true },
  { name: "Database", connected: true },
  { name: "API Server", connected: false },
];
