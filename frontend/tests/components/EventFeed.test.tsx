import { render, screen, fireEvent } from "@testing-library/react";
import EventFeed from "@/components/dashboard/EventFeed";
import { SensorEvent } from "@/types";

const mockEvents: SensorEvent[] = [
  {
    id: 1,
    timestamp: "14:32:01",
    nodeId: 1,
    nodeName: "Node 1",
    message: "Sound threshold exceeded",
    level: "alert",
  },
  {
    id: 2,
    timestamp: "14:31:58",
    nodeId: 2,
    nodeName: "Node 2",
    message: "Footstep activity detected",
    level: "warning",
  },
  {
    id: 3,
    timestamp: "14:31:55",
    nodeId: 3,
    nodeName: "Node 3",
    message: "Sound level back to normal",
    level: "healthy",
  },
];

describe("EventFeed", () => {
  it("renders all events by default", () => {
    render(<EventFeed events={mockEvents} />);
    expect(screen.getByText("Sound threshold exceeded")).toBeInTheDocument();
    expect(screen.getByText("Footstep activity detected")).toBeInTheDocument();
    expect(screen.getByText("Sound level back to normal")).toBeInTheDocument();
  });

  it("filters to only alert events when alert is clicked", () => {
    render(<EventFeed events={mockEvents} />);
    fireEvent.click(screen.getByRole("button", { name: "alert" }));
    expect(screen.getByText("Sound threshold exceeded")).toBeInTheDocument();
    expect(screen.queryByText("Footstep activity detected")).not.toBeInTheDocument();
    expect(screen.queryByText("Sound level back to normal")).not.toBeInTheDocument();
  });

  it("filters to only warning events when warning is clicked", () => {
    render(<EventFeed events={mockEvents} />);
    fireEvent.click(screen.getByRole("button", { name: "warning" }));
    expect(screen.queryByText("Sound threshold exceeded")).not.toBeInTheDocument();
    expect(screen.getByText("Footstep activity detected")).toBeInTheDocument();
    expect(screen.queryByText("Sound level back to normal")).not.toBeInTheDocument();
  });

  it("shows all events again when all is clicked", () => {
    render(<EventFeed events={mockEvents} />);
    fireEvent.click(screen.getByRole("button", { name: "alert" }));
    fireEvent.click(screen.getByRole("button", { name: "all" }));
    expect(screen.getByText("Sound threshold exceeded")).toBeInTheDocument();
    expect(screen.getByText("Footstep activity detected")).toBeInTheDocument();
    expect(screen.getByText("Sound level back to normal")).toBeInTheDocument();
  });
});
