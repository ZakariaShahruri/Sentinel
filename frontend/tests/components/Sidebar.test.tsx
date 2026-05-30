import { render, screen } from "@testing-library/react";
import Sidebar from "@/components/dashboard/Sidebar";

describe("Sidebar", () => {
  it("renders all navigation links", () => {
    render(<Sidebar />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders the platform title", () => {
    render(<Sidebar />);

    expect(screen.getByText("Vibration Monitor")).toBeInTheDocument();
  });

  it("Dashboard link points to the root", () => {
    render(<Sidebar />);

    const dashboardLink = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboardLink).toHaveAttribute("href", "/");
  });
});
