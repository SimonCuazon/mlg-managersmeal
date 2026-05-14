import { notFound } from "next/navigation";
import {
  currentMonthNumber,
  getManager,
  listBranchOptions,
  sumCurrentMonthSpending,
} from "@/lib/lark";
import MealForm from "./MealForm";
import { manilaToday, peso } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CashierPage({
  params,
}: {
  params: Promise<{ recordId: string }>;
}) {
  const { recordId } = await params;
  const manager = await getManager(recordId);
  if (!manager) notFound();

  const inactive = /resign/i.test(manager.position);
  const monthNumber = currentMonthNumber();
  const spent = inactive ? 0 : await sumCurrentMonthSpending(manager.recordId, monthNumber);
  const remaining = Math.max(0, manager.credit - spent);
  const branches = await listBranchOptions();
  const today = manilaToday();

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: 16 }}>
      <header style={{ padding: "16px 8px 12px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", color: "#888" }}>
            MANAGER&apos;S MEAL
          </div>
          <div style={{ fontSize: 11, fontWeight: 500, color: "#888" }}>{today.full}</div>
        </div>
        <h1 style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 800, color: "#1A0000" }}>
          {manager.name}
        </h1>
        <div style={{ marginTop: 2, fontSize: 12, color: "#666" }}>
          {manager.position || "—"}
        </div>
      </header>

      <section
        style={{
          background: "#fff",
          border: "1px solid #E0D5CF",
          borderRadius: 12,
          padding: 20,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", color: "#888" }}>
          AVAILABLE BALANCE
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 26,
            fontWeight: 900,
            color: remaining <= 0 ? "#C62828" : "#1A0000",
          }}
        >
          {peso(remaining)}
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: "#888" }}>
          For {today.monthLabel} · resets on the 1st
        </div>
      </section>

      {inactive && (
        <div
          style={{
            marginTop: 12,
            background: "#FEE2E2",
            color: "#991B1B",
            border: "1px solid #FCA5A5",
            borderRadius: 10,
            padding: "12px 14px",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          This manager is marked Resigned. New transactions are blocked.
        </div>
      )}

      {!inactive && (
        <MealForm
          recordId={manager.recordId}
          managerName={manager.name}
          remaining={remaining}
          branches={branches}
        />
      )}

      <div style={{ marginTop: 20, textAlign: "center" }}>
        <a
          href={`/m/${manager.recordId}/history`}
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#8B0000",
            textDecoration: "none",
            letterSpacing: "0.02em",
          }}
        >
          View transaction history →
        </a>
      </div>
    </main>
  );
}
