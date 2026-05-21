"use client";

import { registerUser } from "@/service/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await registerUser(username, email, password);
      router.push("/login");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-gray-400 text-xs font-medium uppercase tracking-wider">
          Username
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Choose a username"
          className="bg-gray-800/60 border border-gray-700 text-white text-sm rounded-xl px-4 py-3 outline-none focus:border-green-500/50 focus:bg-gray-800 placeholder:text-gray-600 transition-all"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-gray-400 text-xs font-medium uppercase tracking-wider">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          className="bg-gray-800/60 border border-gray-700 text-white text-sm rounded-xl px-4 py-3 outline-none focus:border-green-500/50 focus:bg-gray-800 placeholder:text-gray-600 transition-all"
          autoComplete="email"
          required
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
          placeholder="Choose a password"
          className="bg-gray-800/60 border border-gray-700 text-white text-sm rounded-xl px-4 py-3 outline-none focus:border-green-500/50 focus:bg-gray-800 placeholder:text-gray-600 transition-all"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-gray-400 text-xs font-medium uppercase tracking-wider">
          Confirm Password
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat your password"
          className="bg-gray-800/60 border border-gray-700 text-white text-sm rounded-xl px-4 py-3 outline-none focus:border-green-500/50 focus:bg-gray-800 placeholder:text-gray-600 transition-all"
          required
        />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <p className="text-red-400 text-xs">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-1 bg-green-600 hover:bg-green-500 disabled:bg-green-900 disabled:text-green-700 text-white text-sm font-semibold py-3 rounded-xl transition-all shadow-lg shadow-green-900/30"
      >
        {loading ? "Creating account..." : "Create account"}
      </button>

      <p className="text-gray-600 text-xs text-center">
        Already have an account?{" "}
        <Link href="/login" className="text-gray-400 hover:text-white transition-colors">
          Sign in
        </Link>
      </p>
    </form>
  );
}
