"use client";

import { useState } from "react";

type Props = { recordId: string; managerName: string };

export default function VerifyForm({ recordId, managerName }: Props) {
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/managers/${recordId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: employeeId.trim() }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || `Failed (${res.status})`);
        setBusy(false);
        return;
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        marginTop: 16,
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
        <div style={{ fontSize: 13, color: "#1A0000", lineHeight: 1.5 }}>
          Enter your <strong>Employee ID</strong> to view {managerName.split(" ")[0]}&apos;s
          transaction history.
        </div>
        <div style={{ marginTop: 4, fontSize: 11, color: "#888" }}>
          This data is confidential. Only the manager should access it.
        </div>
      </div>

      <div>
        <label
          htmlFor="empid"
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
          Employee ID
        </label>
        <input
          id="empid"
          type="text"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          required
          autoComplete="off"
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
        disabled={busy || !employeeId.trim()}
        style={{
          background: busy || !employeeId.trim() ? "#5A0000" : "#8B0000",
          color: "#fff",
          fontWeight: 700,
          fontSize: 14,
          padding: "12px 20px",
          borderRadius: 10,
          border: "none",
          cursor: busy ? "wait" : "pointer",
          opacity: busy || !employeeId.trim() ? 0.6 : 1,
        }}
      >
        {busy ? "Verifying…" : "View history"}
      </button>
    </form>
  );
}
