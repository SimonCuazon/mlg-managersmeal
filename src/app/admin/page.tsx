import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import {
  currentMonthNumber,
  listManagers,
  listTransactionsByMonth,
  type ManagerRecord,
  type Transaction,
} from "@/lib/lark";
import { peso, manilaToday } from "@/lib/format";
import AdminFilters from "./AdminFilters";
import SignOutButton from "./SignOutButton";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthLabel(mn: string): string {
  if (mn.length < 5) return mn;
  const year = Number(mn.slice(-4));
  const month = Number(mn.slice(0, mn.length - 4));
  return `${MONTH_NAMES[month - 1] ?? mn} ${year}`;
}

function lastNMonths(n: number): string[] {
  const out: string[] = [];
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getMonth() + 1}${d.getFullYear()}`);
  }
  return out;
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; branch?: string; manager?: string }>;
}) {
  const store = await cookies();
  const session = verifySession(store.get(COOKIE_NAME)?.value);
  if (session?.scope !== "admin") redirect("/admin/login");

  const sp = await searchParams;
  const month = sp.month || currentMonthNumber();
  const branchFilter = sp.branch || "";
  const managerFilter = sp.manager || "";

  const [managers, transactions] = await Promise.all([
    listManagers(),
    listTransactionsByMonth(month),
  ]);

  // Apply filters
  const filtered = transactions.filter((t) => {
    if (branchFilter && t.branch !== branchFilter) return false;
    if (managerFilter && t.managerName !== managerFilter) return false;
    return true;
  });

  // Build per-manager rollup for the selected month
  const byManagerName = new Map<string, { count: number; total: number }>();
  for (const t of transactions) {
    const cur = byManagerName.get(t.managerName) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += t.spentValue;
    byManagerName.set(t.managerName, cur);
  }

  const totalSpent = transactions.reduce((s, t) => s + t.spentValue, 0);
  const totalCount = transactions.length;
  const activeManagers = managers.filter((m) => !/resign/i.test(m.position)).length;
  const overBudgetCount = managers.filter((m) => {
    const r = byManagerName.get(m.name);
    return r && r.total > m.credit;
  }).length;

  const allBranches = Array.from(new Set(transactions.map((t) => t.branch).filter(Boolean))).sort();
  const allManagerNames = Array.from(new Set(managers.map((m) => m.name))).sort();
  const monthOptions = lastNMonths(12);
  const today = manilaToday();

  // Sort manager rollup by total desc
  const managerRollup: Array<{
    manager: ManagerRecord;
    spent: number;
    count: number;
    remaining: number;
    pct: number;
  }> = managers
    .filter((m) => !/resign/i.test(m.position))
    .map((m) => {
      const r = byManagerName.get(m.name) ?? { count: 0, total: 0 };
      const spent = r.total;
      const remaining = Math.max(0, m.credit - spent);
      const pct = m.credit > 0 ? Math.min(999, Math.round((spent / m.credit) * 100)) : 0;
      return { manager: m, spent, count: r.count, remaining, pct };
    })
    .sort((a, b) => b.spent - a.spent);

  const exportHref = `/api/admin/export?month=${encodeURIComponent(month)}${
    branchFilter ? `&branch=${encodeURIComponent(branchFilter)}` : ""
  }${managerFilter ? `&manager=${encodeURIComponent(managerFilter)}` : ""}`;

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", color: "#888" }}>
            MLG MANAGER&apos;S MEAL · ACCOUNTING
          </div>
          <h1 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 800, color: "#1A0000" }}>
            {monthLabel(month)}
          </h1>
          <div style={{ marginTop: 2, fontSize: 12, color: "#666" }}>{today.full}</div>
        </div>
        <SignOutButton />
      </header>

      {/* Stat cards */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <StatCard label="TOTAL SPENT" value={peso(totalSpent)} accent />
        <StatCard label="TRANSACTIONS" value={totalCount.toLocaleString()} />
        <StatCard label="ACTIVE MANAGERS" value={String(activeManagers)} />
        <StatCard
          label="OVER BUDGET"
          value={String(overBudgetCount)}
          warn={overBudgetCount > 0}
        />
      </section>

      <AdminFilters
        monthOptions={monthOptions.map((mn) => ({ value: mn, label: monthLabel(mn) }))}
        branches={allBranches}
        managerNames={allManagerNames}
        current={{ month, branch: branchFilter, manager: managerFilter }}
        exportHref={exportHref}
      />

      {/* Per-manager rollup */}
      <h2 style={{ fontSize: 16, fontWeight: 800, color: "#1A0000", marginTop: 28, marginBottom: 8 }}>
        Manager spending — {monthLabel(month)}
      </h2>
      <div
        style={{
          background: "#fff",
          border: "1px solid #E0D5CF",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <ManagerTable rows={managerRollup} />
      </div>

      {/* Transactions table */}
      <h2 style={{ fontSize: 16, fontWeight: 800, color: "#1A0000", marginTop: 28, marginBottom: 8 }}>
        Transactions {filtered.length !== transactions.length ? `(${filtered.length} of ${transactions.length})` : `(${transactions.length})`}
      </h2>
      <div
        style={{
          background: "#fff",
          border: "1px solid #E0D5CF",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <TransactionTable rows={filtered} />
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      style={{
        background: warn ? "#FEE2E2" : "#fff",
        border: `1px solid ${warn ? "#FCA5A5" : "#E0D5CF"}`,
        borderRadius: 10,
        padding: "12px 16px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: warn ? "#991B1B" : "#888",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 22,
          fontWeight: 900,
          color: warn ? "#991B1B" : accent ? "#8B0000" : "#1A0000",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ManagerTable({
  rows,
}: {
  rows: Array<{
    manager: ManagerRecord;
    spent: number;
    count: number;
    remaining: number;
    pct: number;
  }>;
}) {
  if (rows.length === 0) {
    return <div style={{ padding: 24, color: "#888", fontSize: 13, textAlign: "center" }}>No active managers.</div>;
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ background: "#FAFAFA", color: "#666", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>
          <Th>MANAGER</Th>
          <Th>POSITION</Th>
          <Th align="right">SPENT</Th>
          <Th align="right">REMAINING</Th>
          <Th align="right">USED</Th>
          <Th align="right">TXNS</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ manager, spent, count, remaining, pct }, i) => {
          const over = spent > manager.credit;
          return (
            <tr key={manager.recordId} style={{ borderTop: i === 0 ? "none" : "1px solid #F0EBE8" }}>
              <Td>
                <span style={{ fontWeight: 500, color: "#1A0000" }}>{manager.name}</span>
              </Td>
              <Td>
                <span style={{ color: "#666" }}>{manager.position || "—"}</span>
              </Td>
              <Td align="right">
                <span style={{ fontWeight: 700, color: over ? "#C62828" : "#1A0000" }}>{peso(spent)}</span>
              </Td>
              <Td align="right">
                <span style={{ color: remaining === 0 ? "#C62828" : "#1A0000" }}>{peso(remaining)}</span>
              </Td>
              <Td align="right">
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 20,
                    background: over ? "#FEE2E2" : pct >= 80 ? "#FFFBEB" : "#F0EBE8",
                    color: over ? "#991B1B" : pct >= 80 ? "#854D0E" : "#666",
                  }}
                >
                  {pct}%
                </span>
              </Td>
              <Td align="right">
                <span style={{ color: "#666" }}>{count}</span>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TransactionTable({ rows }: { rows: Transaction[] }) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: 24, color: "#888", fontSize: 13, textAlign: "center" }}>
        No transactions match the filter.
      </div>
    );
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ background: "#FAFAFA", color: "#666", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>
          <Th>DATE</Th>
          <Th>MANAGER</Th>
          <Th>BRANCH</Th>
          <Th>OR #</Th>
          <Th align="right">SPENT</Th>
          <Th>TXN ID</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((t, i) => (
          <tr key={t.recordId} style={{ borderTop: i === 0 ? "none" : "1px solid #F0EBE8" }}>
            <Td>
              <span style={{ color: "#666" }}>
                {new Date(t.date).toLocaleDateString("en-PH", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "Asia/Manila",
                })}
              </span>
            </Td>
            <Td>
              <span style={{ fontWeight: 500, color: "#1A0000" }}>{t.managerName}</span>
            </Td>
            <Td>{t.branch || "—"}</Td>
            <Td>
              <span style={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace", color: "#666" }}>
                {t.orNumber || "—"}
              </span>
            </Td>
            <Td align="right">
              <span style={{ fontWeight: 700, color: "#1A0000" }}>{peso(t.spentValue)}</span>
            </Td>
            <Td>
              <span style={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 11, color: "#888" }}>
                {t.transactionId || "—"}
              </span>
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th style={{ padding: "10px 14px", textAlign: align, fontWeight: 700 }}>{children}</th>
  );
}

function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <td style={{ padding: "10px 14px", textAlign: align, verticalAlign: "middle" }}>{children}</td>
  );
}

