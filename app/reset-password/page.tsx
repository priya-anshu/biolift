"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";

export default function ResetPasswordPage() {
  const { updatePassword, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const minPasswordLength = 10;

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
    const result = await updatePassword(password);
    if (!result.success) {
      setError(result.error ?? "Failed to reset password.");
      return;
    }
    setSuccess("Password updated. You can now sign in.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-day-bg px-6 py-16 text-day-text-primary dark:bg-night-bg dark:text-night-text-primary">
      <div className="w-full max-w-md rounded-2xl border border-day-border bg-day-card p-8 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
        <h1 className="text-2xl font-semibold">Reset Password</h1>
        <p className="mt-2 text-sm text-day-text-secondary dark:text-night-text-secondary">
          Enter a new password to secure your account.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-medium">New Password</label>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-day-border bg-day-card px-3 py-2 dark:border-night-border dark:bg-night-card">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={minPasswordLength}
                placeholder="Enter new password"
                className="w-full bg-transparent text-sm outline-none placeholder:text-day-text-secondary dark:placeholder:text-night-text-secondary"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="text-xs text-day-text-secondary dark:text-night-text-secondary"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Confirm Password</label>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-day-border bg-day-card px-3 py-2 dark:border-night-border dark:bg-night-card">
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={minPasswordLength}
                placeholder="Re-enter new password"
                className="w-full bg-transparent text-sm outline-none placeholder:text-day-text-secondary dark:placeholder:text-night-text-secondary"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="text-xs text-day-text-secondary dark:text-night-text-secondary"
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
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
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-day-text-secondary dark:text-night-text-secondary">
          Back to{" "}
          <Link className="font-semibold text-day-accent-primary dark:text-night-accent" href="/signin">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
