"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthLink, AuthShell } from "@/components/auth-shell";
import { apiGet, apiPost } from "@/lib/api-client";
import { saveAccessToken } from "@/lib/auth";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(
    registered ? "Account created. Sign in below." : null,
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const data = await apiPost<{ access_token: string }>("/api/v1/auth/login", {
        email,
        password,
      });
      saveAccessToken(data.access_token);
      const me = await apiGet<{ email: string; tenant_name: string }>(
        "/api/v1/auth/me",
        data.access_token,
      );
      setSuccess(`Signed in as ${me.email} (${me.tenant_name}). Dashboard coming in Phase 2.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Log in" subtitle="Manage your Calliotel AI agent">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {success ? <p className="text-sm text-green-700">{success}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Log in"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        <AuthLink href="/forgot-password">Forgot password?</AuthLink>
      </p>
      <p className="mt-2 text-center text-sm text-slate-600">
        New here? <AuthLink href="/signup">Create an account</AuthLink>
      </p>
    </AuthShell>
  );
}
