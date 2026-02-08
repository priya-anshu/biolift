"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";

export default function SignUpPage() {
  const router = useRouter();
  const { signUpWithPassword, signInWithGoogle, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const minPasswordLength = 10;
  const confirmStatus =
    confirmPassword.length === 0
      ? null
      : confirmPassword === password
        ? { ok: true, label: "Passwords match" }
        : { ok: false, label: "Passwords do not match" };
  const strengthScore = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
    password.length >= minPasswordLength,
  ].filter(Boolean).length;
  const strengthLabel =
    password.length === 0
      ? ""
      : strengthScore <= 2
        ? "Weak"
        : strengthScore === 3
          ? "Medium"
          : "Strong";
  const strengthColor =
    strengthScore <= 2
      ? "text-red-500"
      : strengthScore === 3
        ? "text-amber-500"
        : "text-emerald-500";

  const handleGoogle = async () => {
    setError(null);
    const result = await signInWithGoogle(
      `${window.location.origin}/auth/callback`,
    );
    if (!result.success) {
      setError(result.error ?? "Google sign-in failed");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (password.length < minPasswordLength) {
      setError(`Password must be at least ${minPasswordLength} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    const result = await signUpWithPassword(
      email,
      password,
      undefined,
      `${window.location.origin}/signin`,
    );
    if (!result.success) {
      setError(result.error ?? "Sign up failed");
      return;
    }
    setSuccess("Account created. Check your email to confirm, then sign in.");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-linear-to-br from-sky-100 via-slate-50 to-emerald-100 dark:from-black dark:via-black dark:to-red-950">
      <div className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-sky-300/30 blur-3xl dark:bg-red-600/25" />
      <div className="pointer-events-none absolute -right-24 bottom-4 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl dark:bg-red-900/30" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 py-16">
        <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-sky-500 to-emerald-500 shadow-lg shadow-sky-500/30 dark:from-red-600 dark:to-red-800 dark:shadow-red-900/40">
          <svg
            viewBox="0 0 24 24"
            className="h-8 w-8 text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M6 7h2l2 5h4l2-5h2" />
            <path d="M5 7v10M19 7v10" />
            <path d="M5 12h14" />
          </svg>
        </div>

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            <span className="bg-linear-to-r from-sky-600 to-emerald-600 bg-clip-text text-transparent dark:from-red-400 dark:to-red-600">
              Create Account
            </span>
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-red-200/80">
            Join BioLift and start your training plan
          </p>
        </div>

        <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white/80 p-8 shadow-xl shadow-slate-200/60 backdrop-blur dark:border-red-900/40 dark:bg-black/80 dark:shadow-red-900/30">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-red-200">
                Email Address
              </label>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-200 dark:border-red-900/60 dark:bg-black dark:text-white dark:focus-within:border-red-500 dark:focus-within:ring-red-500/30">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 text-slate-400 dark:text-red-300"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 4h16v16H4z" />
                  <path d="m4 7 8 5 8-5" />
                </svg>
                <input
                  type="email"
                  required
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-red-300/60"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-red-200">
                Password
              </label>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-200 dark:border-red-900/60 dark:bg-black dark:text-white dark:focus-within:border-red-500 dark:focus-within:ring-red-500/30">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 text-slate-400 dark:text-red-300"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="4" y="11" width="16" height="9" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Create a password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={minPasswordLength}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-red-300/60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:text-red-300/70 dark:hover:text-red-200"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-red-200/70">
                <span>
                  Strength:{" "}
                  {strengthLabel ? (
                    <span className={`font-semibold ${strengthColor}`}>
                      {strengthLabel}
                    </span>
                  ) : (
                    <span className="text-slate-300 dark:text-red-200/40">
                      —
                    </span>
                  )}
                </span>
                <span>Min {minPasswordLength} chars</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-red-200">
                Confirm Password
              </label>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-200 dark:border-red-900/60 dark:bg-black dark:text-white dark:focus-within:border-red-500 dark:focus-within:ring-red-500/30">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={minPasswordLength}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-red-300/60"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:text-red-300/70 dark:hover:text-red-200"
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
              {confirmStatus ? (
                <div
                  className={`mt-2 text-xs font-semibold ${
                    confirmStatus.ok ? "text-emerald-500" : "text-red-500"
                  }`}
                >
                  {confirmStatus.label}
                </div>
              ) : null}
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-200">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                {success}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-700 dark:bg-red-600 dark:shadow-red-900/40 dark:hover:bg-red-700"
            >
              {loading ? "Creating..." : "Create Account"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-4 text-xs text-slate-400 dark:text-red-200/70">
            <span className="h-px w-full bg-slate-200 dark:bg-red-900/50" />
            Or continue with
            <span className="h-px w-full bg-slate-200 dark:bg-red-900/50" />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button
              type="button"
              onClick={handleGoogle}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 dark:border-red-700/60 dark:bg-black dark:text-red-100 dark:hover:border-red-600"
            >
              <Image
                src="/google-logo.svg"
                alt="Google"
                width={16}
                height={16}
              />
              Continue with Google
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-slate-600 dark:text-red-200/80">
            Already have an account?{" "}
            <Link
              href="/signin"
              className="font-semibold text-sky-600 hover:text-sky-700 dark:text-red-300 dark:hover:text-red-200"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
