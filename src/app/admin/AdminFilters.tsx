"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  monthOptions: { value: string; label: string }[];
  branches: string[];
  managerNames: string[];
  current: { month: string; branch: string; manager: string };
  exportHref: string;
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.04em",
  color: "#888",
  marginBottom: 4,
  textTransform: "uppercase",
};

const fieldStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #E0D5CF",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  color: "#1A0000",
  fontFamily: "inherit",
  minWidth: 160,
};

export default function AdminFilters({ monthOptions, branches, managerNames, current, exportHref }: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  function update(key: "month" | "branch" | "manager", value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/admin?${params.toString()}`);
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E0D5CF",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-end",
        gap: 12,
      }}
    >
      <div>
        <label style={labelStyle} htmlFor="f-month">Month</label>
        <select
          id="f-month"
          value={current.month}
          onChange={(e) => update("month", e.target.value)}
          style={fieldStyle}
        >
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelStyle} htmlFor="f-branch">Branch</label>
        <select
          id="f-branch"
          value={current.branch}
          onChange={(e) => update("branch", e.target.value)}
          style={fieldStyle}
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelStyle} htmlFor="f-manager">Manager</label>
        <select
          id="f-manager"
          value={current.manager}
          onChange={(e) => update("manager", e.target.value)}
          style={fieldStyle}
        >
          <option value="">All managers</option>
          {managerNames.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
      <div style={{ marginLeft: "auto" }}>
        <a
          href={exportHref}
          style={{
            display: "inline-block",
            background: "#8B0000",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            padding: "9px 18px",
            borderRadius: 10,
            border: "none",
            textDecoration: "none",
          }}
        >
          Export CSV
        </a>
      </div>
    </div>
  );
}
