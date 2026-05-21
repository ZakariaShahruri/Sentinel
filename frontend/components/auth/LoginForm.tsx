"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getMe, loginUser, verifyOtp } from "@/service/api";

const SESSION_COOKIE_MAX_AGE = 60 * 60;
const ROLE_COOKIE_MAX_AGE = SESSION_COOKIE_MAX_AGE;

type AuthStep = "credentials" | "otp";

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");

  return `${minutes}:${seconds}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Authentication failed";
}

export default function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<AuthStep>("credentials");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState<string | null>(null);
  const [otpNowMs, setOtpNowMs] = useState(() => Date.now());
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (step !== "otp" || !otpExpiresAt) {
      return;
    }

    const interval = window.setInterval(() => {
      setOtpNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [otpExpiresAt, step]);

  const secondsRemaining = useMemo(() => {
    if (step !== "otp" || !otpExpiresAt) {
      return 0;
    }

    const expiresAt = Date.parse(otpExpiresAt);
    if (Number.isNaN(expiresAt)) {
      return 0;
    }

    return Math.max(0, Math.ceil((expiresAt - otpNowMs) / 1000));
  }, [otpExpiresAt, otpNowMs, step]);

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

    const interval = window.setInterval(() => {
      setResendCooldown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [resendCooldown]);

  function persistSession(token: string) {
    document.cookie = `access_token=${encodeURIComponent(token)}; path=/; max-age=${SESSION_COOKIE_MAX_AGE}; samesite=lax`;
  }

  function persistRole(role: string | null) {
    if (!role) {
      return;
    }

    document.cookie = `user_role=${encodeURIComponent(role)}; path=/; max-age=${ROLE_COOKIE_MAX_AGE}; samesite=lax`;
  }

  async function finalizeAuthentication(token?: string) {
    if (token) {
      persistSession(token);
    }

    try {
      const session = await getMe();
      persistRole(session.role);
      router.replace(session.role === "player" ? "/game" : "/");
    } catch (err) {
      router.replace("/");
    }
  }

  async function requestLoginChallenge() {
    const response = await loginUser(identifier.trim(), password);

    // If the server returned a user role directly, use it immediately.
    if (response.user && response.user.role) {
      if (response.access_token) {
        persistSession(response.access_token);
      }
      persistRole(response.user.role);
      router.replace(response.user.role === "player" ? "/game" : "/");
      return;
    }

    if (response.requires_otp) {
      setStep("otp");
      setEmail((response.email ?? identifier.trim()).toLowerCase());
      setOtpExpiresAt(response.otp_expires_at ?? null);
      setOtpNowMs(Date.now());
      setOtp("");
      setError("");
      return;
    }

    await finalizeAuthentication(response.access_token);
  }

  async function handleVerifyOtp() {
    const response = await verifyOtp(email, otp.trim());
    // Prefer response-provided role if present.
    if (response.user && response.user.role) {
      if (response.access_token) persistSession(response.access_token);
      persistRole(response.user.role);
      router.replace(response.user.role === "player" ? "/game" : "/");
      return;
    }

    await finalizeAuthentication(response.access_token);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    // Clear any stale role from previous sessions before starting a new login.
    document.cookie = "user_role=; path=/; max-age=0; samesite=lax";
    setLoading(true);

    try {
      if (step === "otp") {
        await handleVerifyOtp();
      } else {
        await requestLoginChallenge();
      }
    } catch (err: unknown) {
      const status = err instanceof Error ? (err as { status?: number }).status : undefined;
      const retryAfter =
        err instanceof Error ? (err as { retryAfter?: number }).retryAfter : undefined;

      if (status === 429) {
        setResendCooldown(retryAfter ?? 60);
        setError("Too many attempts. Please wait before trying again.");
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    if (loading || resendCooldown > 0) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await loginUser(identifier.trim(), password);

      if (response.requires_otp) {
        setEmail((response.email ?? identifier.trim()).toLowerCase());
        setOtpExpiresAt(response.otp_expires_at ?? null);
        setOtpNowMs(Date.now());
        setOtp("");
        return;
      }

      await finalizeAuthentication(response.access_token);
    } catch (err: unknown) {
      const status = err instanceof Error ? (err as { status?: number }).status : undefined;
      const retryAfter =
        err instanceof Error ? (err as { retryAfter?: number }).retryAfter : undefined;

      if (status === 429) {
        setResendCooldown(retryAfter ?? 60);
        setError("Too many attempts. Please wait before requesting a new code.");
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }

  const otpExpired = step === "otp" && secondsRemaining === 0;
  const verificationDisabled = loading || (step === "otp" && otpExpired && otp.trim().length !== 6);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-gray-400 text-xs font-medium uppercase tracking-wider">
          Username or email
        </label>
        <input
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Enter your username or email"
          className="bg-gray-800/60 border border-gray-700 text-white text-sm rounded-xl px-4 py-3 outline-none focus:border-green-500/50 focus:bg-gray-800 placeholder:text-gray-600 transition-all"
          required
          disabled={step === "otp"}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-gray-400 text-xs font-medium uppercase tracking-wider">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          className="bg-gray-800/60 border border-gray-700 text-white text-sm rounded-xl px-4 py-3 outline-none focus:border-green-500/50 focus:bg-gray-800 placeholder:text-gray-600 transition-all"
          required
          disabled={step === "otp"}
        />
      </div>

      {step === "otp" && (
        <div className="flex flex-col gap-4 rounded-xl border border-gray-700 bg-gray-900/60 p-4">
          <div className="flex flex-col gap-1">
            <p className="text-gray-200 text-sm font-medium">Enter the 6-digit code</p>
            <p className="text-gray-500 text-xs">
              We sent a one-time code to {email}.{" "}
              {secondsRemaining > 0
                ? `It expires in ${formatCountdown(secondsRemaining)}.`
                : "The code has expired."}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-gray-400 text-xs font-medium uppercase tracking-wider">
              OTP code
            </label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="123456"
              className="bg-gray-800/60 border border-gray-700 text-white text-sm rounded-xl px-4 py-3 outline-none focus:border-green-500/50 focus:bg-gray-800 placeholder:text-gray-600 transition-all tracking-[0.35em] text-center"
              autoComplete="one-time-code"
              required={step === "otp"}
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-gray-500">
              {resendCooldown > 0
                ? `Resend available in ${formatCountdown(resendCooldown)}`
                : "Need a new code?"}
            </span>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={loading || resendCooldown > 0}
              className="text-green-400 hover:text-green-300 disabled:text-gray-600 transition-colors"
            >
              Resend code
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <p className="text-red-400 text-xs">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={verificationDisabled}
        className="mt-1 bg-green-600 hover:bg-green-500 disabled:bg-green-900 disabled:text-green-700 text-white text-sm font-semibold py-3 rounded-xl transition-all shadow-lg shadow-green-900/30"
      >
        {loading ? "Please wait..." : step === "otp" ? "Verify code" : "Sign in"}
      </button>

      <p className="text-gray-600 text-xs text-center">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-gray-400 hover:text-white transition-colors">
          Register
        </Link>
      </p>
    </form>
  );
}
