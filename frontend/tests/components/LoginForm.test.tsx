import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginForm from "@/components/auth/LoginForm";

const replaceMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

jest.mock("@/service/api", () => ({
  getMe: jest.fn(),
  loginUser: jest.fn(),
  verifyOtp: jest.fn(),
}));

const { getMe, loginUser, verifyOtp } = jest.requireMock("@/service/api") as {
  getMe: jest.Mock;
  loginUser: jest.Mock;
  verifyOtp: jest.Mock;
};

describe("LoginForm", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    getMe.mockReset();
    loginUser.mockReset();
    verifyOtp.mockReset();
    document.cookie = "access_token=; path=/; max-age=0; samesite=lax";
    document.cookie = "user_role=; path=/; max-age=0; samesite=lax";
  });

  it("routes admins to the dashboard after login", async () => {
    loginUser.mockResolvedValue({
      access_token: "admin-token",
      user: { id: 1, username: "admin", role: "admin" },
    });
    getMe.mockResolvedValue({ username: "admin", role: "admin", user_id: 1 });

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText("Enter your username or email"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter your password"), {
      target: { value: "admin123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/"));
    expect(document.cookie).toContain("user_role=admin");
  });

  it("routes players to the marble game after OTP verification", async () => {
    loginUser.mockResolvedValueOnce({
      requires_otp: true,
      email: "player1@sentinel.local",
      otp_expires_at: "2030-01-01T00:00:00.000Z",
    });
    verifyOtp.mockResolvedValue({
      access_token: "player-token",
      user: { id: 2, username: "player1", role: "player" },
    });
    getMe.mockResolvedValue({ username: "player1", role: "player", user_id: 2 });

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText("Enter your username or email"), {
      target: { value: "player1" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter your password"), {
      target: { value: "player1pass" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText(/Enter the 6-digit code/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("123456"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/game"));
    expect(document.cookie).toContain("user_role=player");
  });
});
