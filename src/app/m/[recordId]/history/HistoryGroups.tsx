"use client";

import { useMemo, useState } from "react";
import type { Transaction } from "@/lib/lark";
import { peso } from "@/lib/format";

type Props = {
  transactions: Transaction[];
  currentMonthNumber: string;
  recordId: string;
};

type Group = {
  monthNumber: string;
  label: string;
  total: number;
  count: number;
  rows: Transaction[];
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parseMonthNumber(mn: string): { year: number; month: number } {
  // Lark format: e.g. "52026" = May 2026; "112025" = Nov 2025
  if (mn.length < 5) return { year: 0, month: 0 };
  const year = Number(mn.slice(-4));
  const month = Number(mn.slice(0, mn.length - 4));
  return { year, month };
}

function monthLabel(mn: string): string {
  const { year, month } = parseMonthNumber(mn);
  if (!year || !month) return mn || "Unknown";
  return `${MONTH_NAMES[month - 1] ?? mn} ${year}`;
}

function monthSortKey(mn: string): number {
  const { year, month } = parseMonthNumber(mn);
  return year * 100 + month;
}

function manilaDay(ms: number): string {
  return new Date(ms).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  });
}

export default function HistoryGroups({ transactions, currentMonthNumber, recordId }: Props) {
  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const t of transactions) {
      const mn = t.monthNumber || "unknown";
      const g = map.get(mn) ?? {
        monthNumber: mn,
        label: monthLabel(mn),
        total: 0,
        count: 0,
        rows: [],
      };
      g.rows.push(t);
      g.total += t.spentValue;
      g.count += 1;
      map.set(mn, g);
    }
    const arr = Array.from(map.values());
    // Newest month first
    arr.sort((a, b) => monthSortKey(b.monthNumber) - monthSortKey(a.monthNumber));
    return arr;
  }, [transactions]);

  // Current month expanded by default; others collapsed.
  const [open, setOpen] = useState<Record<string, boolean>>(() => ({
    [currentMonthNumber]: true,
  }));

  function toggle(mn: string) {
    setOpen((prev) => ({ ...prev, [mn]: !prev[mn] }));
  }

  async function signOut() {
    await fetch(`/api/managers/${recordId}/verify`, { method: "DELETE" });
    window.location.href = `/m/${recordId}`;
  }

  if (groups.length === 0) {
    return (
      <section
        style={{
          marginTop: 16,
          background: "#fff",
          border: "1px solid #E0D5CF",
          borderRadius: 12,
          padding: 24,
          textAlign: "center",
          color: "#888",
          fontSize: 13,
        }}
      >
        No transactions yet.
      </section>
    );
  }

  return (
    <>
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {groups.map((g) => {
          const isOpen = !!open[g.monthNumber];
          const isCurrent = g.monthNumber === currentMonthNumber;
          return (
            <section
              key={g.monthNumber}
              style={{
                background: "#fff",
                border: "1px solid #E0D5CF",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() => toggle(g.monthNumber)}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 18px",
                  background: isCurrent ? "#FFF7ED" : "#FAFAFA",
                  border: "none",
                  borderBottom: isOpen ? "1px solid #E0D5CF" : "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#1A0000" }}>
                    {g.label}
                    {isCurrent && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 10,
                          fontWeight: 700,
                          background: "#DCFCE7",
                          color: "#166534",
                          padding: "2px 8px",
                          borderRadius: 20,
                        }}
                      >
                        CURRENT
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 2, fontSize: 11, color: "#666" }}>
                    {g.count} {g.count === 1 ? "transaction" : "transactions"} · Total {peso(g.total)}
                  </div>
                </div>
                <span style={{ fontSize: 18, color: "#888", fontWeight: 700 }}>
                  {isOpen ? "−" : "+"}
                </span>
              </button>

              {isOpen && (
                <div>
                  {g.rows.map((t, i) => (
                    <div
                      key={t.recordId}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "60px 1fr auto",
                        gap: 12,
                        alignItems: "center",
                        padding: "12px 18px",
                        borderTop: i === 0 ? "none" : "1px solid #F0EBE8",
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#666" }}>
                        {manilaDay(t.date)}
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: "#1A0000",
                            lineHeight: 1.3,
                          }}
                        >
                          {t.branch || "—"}
                        </div>
                        <div
                          style={{
                            marginTop: 2,
                            fontSize: 11,
                            color: "#888",
                            fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                          }}
                        >
                          OR {t.orNumber || "—"}
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#1A0000" }}>
                        {peso(t.spentValue)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <button
        onClick={signOut}
        style={{
          marginTop: 20,
          background: "#FAFAFA",
          color: "#666",
          border: "1px solid #E0D5CF",
          borderRadius: 8,
          padding: "9px 14px",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Sign out
      </button>
    </>
  );
}
