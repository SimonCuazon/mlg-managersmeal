import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import { currentMonthNumber, listTransactionsByMonth } from "@/lib/lark";

export const runtime = "nodejs";

function csvCell(v: string | number): string {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const store = await cookies();
  if (verifySession(store.get(COOKIE_NAME)?.value)?.scope !== "admin") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const month = url.searchParams.get("month") || currentMonthNumber();
  const branch = url.searchParams.get("branch") || "";
  const manager = url.searchParams.get("manager") || "";

  const txns = await listTransactionsByMonth(month);
  const filtered = txns.filter((t) => {
    if (branch && t.branch !== branch) return false;
    if (manager && t.managerName !== manager) return false;
    return true;
  });

  const header = [
    "Transaction ID",
    "Date (Manila)",
    "Manager",
    "Branch",
    "OR Number",
    "Spent Value (PHP)",
    "Month Number",
  ];
  const lines: string[] = [header.map(csvCell).join(",")];
  for (const t of filtered) {
    const dateStr = new Date(t.date).toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    lines.push(
      [
        t.transactionId,
        dateStr,
        t.managerName,
        t.branch,
        t.orNumber,
        t.spentValue.toFixed(2),
        t.monthNumber,
      ].map(csvCell).join(",")
    );
  }

  const filename = `mlg-meal-${month}${branch ? `-${branch.replace(/[^a-z0-9]+/gi, "_")}` : ""}${
    manager ? `-${manager.replace(/[^a-z0-9]+/gi, "_")}` : ""
  }.csv`;

  return new NextResponse(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
