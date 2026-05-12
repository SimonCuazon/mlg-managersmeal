import { NextResponse } from "next/server";
import {
  createTransaction,
  currentMonthNumber,
  getManager,
  listBranchOptions,
  sumCurrentMonthSpending,
} from "@/lib/lark";

export const runtime = "nodejs";

type Body = {
  managerRecordId?: string;
  branchName?: string;
  orNumber?: string;
  spentValue?: number;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { managerRecordId, branchName, orNumber, spentValue } = body;

  if (!managerRecordId || typeof managerRecordId !== "string") {
    return NextResponse.json({ ok: false, error: "Missing manager" }, { status: 400 });
  }
  if (!branchName || typeof branchName !== "string") {
    return NextResponse.json({ ok: false, error: "Missing branch" }, { status: 400 });
  }
  if (!orNumber || typeof orNumber !== "string" || orNumber.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "Missing OR number" }, { status: 400 });
  }
  if (typeof spentValue !== "number" || !Number.isFinite(spentValue) || spentValue <= 0) {
    return NextResponse.json({ ok: false, error: "Spent value must be a positive number" }, { status: 400 });
  }

  const manager = await getManager(managerRecordId);
  if (!manager) {
    return NextResponse.json({ ok: false, error: "Manager not found" }, { status: 404 });
  }
  if (/resign/i.test(manager.position)) {
    return NextResponse.json({ ok: false, error: "Manager is inactive" }, { status: 403 });
  }

  const branches = await listBranchOptions();
  if (!branches.some((b) => b.name === branchName)) {
    return NextResponse.json({ ok: false, error: "Unknown branch" }, { status: 400 });
  }

  const monthNumber = currentMonthNumber();
  const spentSoFar = await sumCurrentMonthSpending(manager.recordId, monthNumber);
  const remaining = Math.max(0, manager.credit - spentSoFar);

  if (spentValue > remaining) {
    return NextResponse.json(
      {
        ok: false,
        error: `Exceeds available balance. Available: ₱${remaining.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
      { status: 409 }
    );
  }

  const result = await createTransaction({
    managerRecordId: manager.recordId,
    managerName: manager.name,
    branchName,
    orNumber: orNumber.trim(),
    spentValue,
  });

  return NextResponse.json({
    ok: true,
    transactionId: result.transactionId,
    spent: spentValue,
    newRemaining: Math.max(0, remaining - spentValue),
  });
}
