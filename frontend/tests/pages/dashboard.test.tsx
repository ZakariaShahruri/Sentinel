import { render, screen } from "@testing-library/react";
import DashboardPage from "@/app/page";

jest.mock("next/navigation", () => ({
  useRouter() {
    return {
      prefetch: () => null,
      push: jest.fn(),
    };
  },
}));
jest.mock("@/service/api", () => ({
  getNodes: jest.fn().mockResolvedValue([]),
  getEvents: jest.fn().mockResolvedValue([]),
}));

jest.mock(
  "../../components/dashboard/SensorChart",
  () =>
    function SensorChartMock() {
      return <div>Sensor Chart</div>;
    }
);

jest.mock(
  "../../components/dashboard/LiveClock",
  () =>
    function LiveClockMock() {
      return <div>00:00:00</div>;
    }
);

describe("Dashboard Page", () => {
  it("renders the nodes overview section", async () => {
    render(await DashboardPage());
    expect(screen.getByText("Nodes Overview")).toBeInTheDocument();
  });

  it("renders the live event feed", async () => {
    render(await DashboardPage());
    expect(screen.getByText("Live Event Feed")).toBeInTheDocument();
  });

  it("renders the system health section", async () => {
    render(await DashboardPage());
    expect(screen.getByText("System Health")).toBeInTheDocument();
  });
});
