import { render, screen } from "@testing-library/react";
import NodeCard from "@/components/dashboard/NodeCard";
import { SensorNode } from "@/types";

const mockNode: SensorNode = {
  id: 1,
  name: "Node 1",
  location: "Classroom",
  status: "alert",
  lastSeen: "1s ago",
  latestEventClass: "attack",
  peakAmplitude: 1.23,
  confidence: 85,
};

describe("NodeCard", () => {
  it("renders node name and location", () => {
    render(<NodeCard node={mockNode} />);
    expect(screen.getByText("Node 1")).toBeInTheDocument();
    expect(screen.getByText("Classroom")).toBeInTheDocument();
  });

  it("shows the status badge", () => {
    render(<NodeCard node={mockNode} />);
    expect(screen.getByText("ALERT")).toBeInTheDocument();
  });

  it("shows the latest event class", () => {
    render(<NodeCard node={mockNode} />);
    expect(screen.getByText("attack")).toBeInTheDocument();
  });

  it("shows peak amplitude and confidence", () => {
    render(<NodeCard node={mockNode} />);
    expect(screen.getByText("1.23 g")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("shows last seen time", () => {
    render(<NodeCard node={mockNode} />);
    expect(screen.getByText("Last seen: 1s ago")).toBeInTheDocument();
  });
});
