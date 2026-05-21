import { io, Socket } from "socket.io-client";
import { getApiBaseUrl } from "@/service/api";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(getApiBaseUrl(), {
      transports: ["websocket"],
      autoConnect: true,
    });

    socket.on("connect", () => {
      console.log("[SIO] Connected:", socket!.id);
      socket!.emit("joinRoom", "vibrationEN04");
    });
  }
  return socket;
}
