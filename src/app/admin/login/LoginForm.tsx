"use client";

import { useState } from "react";

export default function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || `Failed (${res.status})`);
        setBusy(false);
        return;
      }
      window.location.href = "/admin";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        background: "#fff",
        border: "1px solid #E0D5CF",
        borderRadius: 12,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div>
        <label
          htmlFor="pw"
          style={{
            display: "block",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: "#666",
            marginBottom: 6,
            textTransform: "uppercase",
          }}
        >
          Admin password
        </label>
        <input
          id="pw"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
          style={{
            width: "100%",
            background: "#fff",
            border: `1px solid ${error ? "#B71C1C" : "#E0D5CF"}`,
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 14,
            color: "#1A0000",
            boxSizing: "border-box",
            fontFamily: "inherit",
          }}
        />
      </div>
      {error && (
        <div
          style={{
            background: "#FEE2E2",
            color: "#991B1B",
            border: "1px solid #FCA5A5",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={busy || !password}
        style={{
          background: busy || !password ? "#5A0000" : "#8B0000",
          color: "#fff",
          fontWeight: 700,
          fontSize: 14,
          padding: "12px 20px",
          borderRadius: 10,
          border: "none",
          cursor: busy ? "wait" : "pointer",
          opacity: busy || !password ? 0.6 : 1,
        }}
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
