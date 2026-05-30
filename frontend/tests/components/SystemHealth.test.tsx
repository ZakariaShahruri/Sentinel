import { render, screen } from "@testing-library/react";
import SystemHealth from "@/components/dashboard/SystemHealth";

const mockServices = [
  { name: "MQTT broker", connected: true },
  { name: "WebSocket", connected: true },
  { name: "Database", connected: false },
];

describe("SystemHealth", () => {
  it("renders all service names", () => {
    render(<SystemHealth services={mockServices} />);

    expect(screen.getByText("MQTT broker")).toBeInTheDocument();
    expect(screen.getByText("WebSocket")).toBeInTheDocument();
    expect(screen.getByText("Database")).toBeInTheDocument();
  });

  it("shows Connected for connected services", () => {
    render(<SystemHealth services={mockServices} />);

    const connectedLabels = screen.getAllByText("Connected");
    expect(connectedLabels).toHaveLength(2);
  });

  it("shows Disconnected for disconnected services", () => {
    render(<SystemHealth services={mockServices} />);

    expect(screen.getByText("Disconnected")).toBeInTheDocument();
  });
});
