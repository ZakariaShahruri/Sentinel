import { render, screen } from "@testing-library/react";
import Header from "@/components/dashboard/Header";

jest.mock("next/navigation", () => ({
  useRouter() {
    return {
      prefetch: () => null,
      push: jest.fn(),
    };
  },
}));
jest.mock(
  "../../components/dashboard/LiveClock",
  () =>
    function LiveClockMock() {
      return <div>00:00:00</div>;
    }
);

describe("Header", () => {
  it("shows ONLINE when system is online", () => {
    render(<Header systemOnline={true} nodesOnline={4} totalNodes={4} uptime="1d 2h" />);
    expect(screen.getByText("ONLINE")).toBeInTheDocument();
  });

  it("shows OFFLINE when system is offline", () => {
    render(<Header systemOnline={false} nodesOnline={0} totalNodes={4} uptime="0h" />);
    expect(screen.getByText("OFFLINE")).toBeInTheDocument();
  });

  it("shows node online count", () => {
    render(<Header systemOnline={true} nodesOnline={3} totalNodes={4} uptime="1d" />);
    expect(screen.getByText("3 / 4")).toBeInTheDocument();
  });

  it("shows uptime", () => {
    render(<Header systemOnline={true} nodesOnline={4} totalNodes={4} uptime="2d 14h 32m" />);
    expect(screen.getByText("2d 14h 32m")).toBeInTheDocument();
  });
});
