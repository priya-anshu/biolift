"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";

export default function ForgotPasswordPage() {
  const { resetPasswordForEmail, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const result = await resetPasswordForEmail(
      email,
      `${window.location.origin}/reset-password`,
    );
    if (!result.success) {
      setError(result.error ?? "Failed to send reset email.");
      return;
    }
    setSuccess("Password reset email sent. Please check your inbox.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-day-bg px-6 py-16 text-day-text-primary dark:bg-night-bg dark:text-night-text-primary">
      <div className="w-full max-w-md rounded-2xl border border-day-border bg-day-card p-8 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
        <h1 className="text-2xl font-semibold">Forgot Password</h1>
        <p className="mt-2 text-sm text-day-text-secondary dark:text-night-text-secondary">
          We’ll send you a reset link to set a new password.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-medium">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email"
              className="input-field mt-2"
            />
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

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-day-text-secondary dark:text-night-text-secondary">
          Remembered your password?{" "}
          <Link className="font-semibold text-day-accent-primary dark:text-night-accent" href="/signin">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
