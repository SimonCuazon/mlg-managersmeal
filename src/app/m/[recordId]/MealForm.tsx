"use client";

import { useMemo, useState } from "react";
import { peso } from "@/lib/format";

type Props = {
  recordId: string;
  managerName: string;
  remaining: number;
  branches: { id: string; name: string }[];
};

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string }
  | { kind: "success"; transactionId: string; spent: number; newRemaining: number };

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#fff",
  border: "1px solid #E0D5CF",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  color: "#1A0000",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.04em",
  color: "#666",
  marginBottom: 6,
  textTransform: "uppercase",
};

export default function MealForm({ recordId, managerName, remaining, branches }: Props) {
  const [branch, setBranch] = useState("");
  const [orNumber, setOrNumber] = useState("");
  const [spent, setSpent] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const spentNum = useMemo(() => Number(spent), [spent]);
  const overLimit = spentNum > remaining;
  const canSubmit =
    status.kind !== "submitting" &&
    branch !== "" &&
    orNumber.trim() !== "" &&
    spent !== "" &&
    spentNum > 0 &&
    !overLimit;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus({ kind: "submitting" });
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          managerRecordId: recordId,
          branchName: branch,
          orNumber: orNumber.trim(),
          spentValue: spentNum,
        }),
      });
      const data = (await res.json()) as
        | { ok: true; transactionId: string; spent: number; newRemaining: number }
        | { ok: false; error: string };
      if (!res.ok || !data.ok) {
        setStatus({ kind: "error", message: ("error" in data && data.error) || `Request failed (${res.status})` });
        return;
      }
      setStatus({
        kind: "success",
        transactionId: data.transactionId,
        spent: data.spent,
        newRemaining: data.newRemaining,
      });
      setBranch("");
      setOrNumber("");
      setSpent("");
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Network error" });
    }
  }

  if (status.kind === "success") {
    return (
      <section
        style={{
          marginTop: 16,
          background: "#fff",
          border: "1px solid #E0D5CF",
          borderRadius: 12,
          padding: 24,
        }}
      >
        <div
          style={{
            display: "inline-block",
            background: "#DCFCE7",
            color: "#166534",
            fontSize: 11,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: 20,
          }}
        >
          LOGGED
        </div>
        <h2 style={{ margin: "12px 0 4px", fontSize: 18, fontWeight: 800, color: "#1A0000" }}>
          {peso(status.spent)} charged to {managerName}
        </h2>
        <div style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
          Transaction ID: <span style={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace" }}>{status.transactionId}</span>
        </div>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 4, letterSpacing: "0.04em", fontWeight: 700 }}>
          AVAILABLE BALANCE
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#1A0000", marginBottom: 20 }}>
          {peso(status.newRemaining)}
        </div>
        <button
          onClick={() => setStatus({ kind: "idle" })}
          style={{
            background: "#8B0000",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            padding: "11px 20px",
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            width: "100%",
          }}
        >
          Log another transaction
        </button>
      </section>
    );
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
        <label htmlFor="branch" style={labelStyle}>
          Branch *
        </label>
        <select
          id="branch"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          required
          style={{ ...inputStyle, appearance: "auto" }}
        >
          <option value="">Select a branch…</option>
          {branches.map((b) => (
            <option key={b.id} value={b.name}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="or" style={labelStyle}>
          OR Number *
        </label>
        <input
          id="or"
          type="text"
          value={orNumber}
          onChange={(e) => setOrNumber(e.target.value)}
          required
          inputMode="numeric"
          autoComplete="off"
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="spent" style={labelStyle}>
          Spent Value (₱) *
        </label>
        <input
          id="spent"
          type="number"
          step="0.01"
          min="0.01"
          value={spent}
          onChange={(e) => setSpent(e.target.value)}
          required
          inputMode="decimal"
          autoComplete="off"
          style={{
            ...inputStyle,
            borderColor: overLimit ? "#B71C1C" : "#E0D5CF",
            background: overLimit ? "#FFF5F5" : "#fff",
          }}
        />
        {overLimit && (
          <div style={{ marginTop: 6, fontSize: 11, color: "#B71C1C", fontWeight: 700 }}>
            Exceeds available balance ({peso(remaining)}).
          </div>
        )}
      </div>

      {status.kind === "error" && (
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
          {status.message}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        style={{
          background: canSubmit ? "#8B0000" : "#5A0000",
          color: "#fff",
          fontWeight: 700,
          fontSize: 14,
          padding: "12px 20px",
          borderRadius: 10,
          border: "none",
          cursor: canSubmit ? "pointer" : "wait",
          opacity: canSubmit ? 1 : 0.6,
        }}
      >
        {status.kind === "submitting" ? "Submitting…" : "Submit transaction"}
      </button>
    </form>
  );
}
