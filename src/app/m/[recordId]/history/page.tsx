import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import {
  currentMonthNumber,
  getManager,
  listManagerTransactions,
  sumCurrentMonthSpending,
} from "@/lib/lark";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import { manilaToday, peso } from "@/lib/format";
import VerifyForm from "./VerifyForm";
import HistoryGroups from "./HistoryGroups";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ recordId: string }>;
}) {
  const { recordId } = await params;
  const manager = await getManager(recordId);
  if (!manager) notFound();

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME)?.value;
  const session = verifySession(sessionCookie);
  const isAuthed = session?.scope === `manager:${recordId}`;

  const today = manilaToday();

  // Common header (always shown)
  const header = (
    <header style={{ padding: "16px 8px 12px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 8,
        }}
      >
        <Link
          href={`/m/${recordId}`}
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: "#8B0000",
            textDecoration: "none",
          }}
        >
          ← BACK TO FORM
        </Link>
        <div style={{ fontSize: 11, fontWeight: 500, color: "#888" }}>{today.full}</div>
      </div>
      <h1 style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 800, color: "#1A0000" }}>
        {manager.name}
      </h1>
      <div style={{ marginTop: 2, fontSize: 12, color: "#666" }}>
        {manager.position || "—"} · Transaction History
      </div>
    </header>
  );

  if (!isAuthed) {
    return (
      <main style={{ maxWidth: 520, margin: "0 auto", padding: 16 }}>
        {header}
        <VerifyForm recordId={recordId} managerName={manager.name} />
      </main>
    );
  }

  // Authed — fetch everything
  const monthNumber = currentMonthNumber();
  const [transactions, spent] = await Promise.all([
    listManagerTransactions(recordId),
    sumCurrentMonthSpending(recordId, monthNumber),
  ]);
  const remaining = Math.max(0, manager.credit - spent);

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 16 }}>
      {header}

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
          For {today.monthLabel} · {transactions.filter((t) => t.monthNumber === monthNumber).length}{" "}
          transactions this month
        </div>
      </section>

      <HistoryGroups
        transactions={transactions}
        currentMonthNumber={monthNumber}
        recordId={recordId}
      />
    </main>
  );
}
