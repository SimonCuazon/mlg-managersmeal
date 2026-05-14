import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getManager } from "@/lib/lark";
import { COOKIE_NAME, COOKIE_OPTIONS, newSession } from "@/lib/auth";

export const runtime = "nodejs";

type Body = { employeeId?: string };

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.SESSION_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Server missing SESSION_SECRET env var. Add it in Vercel and redeploy." },
      { status: 503 }
    );
  }
  const { id } = await params;
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const employeeId = (body.employeeId ?? "").trim();
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Employee ID is required" }, { status: 400 });
  }

  const manager = await getManager(id);
  if (!manager) {
    return NextResponse.json({ ok: false, error: "Manager not found" }, { status: 404 });
  }
  if (!manager.employeeId) {
    return NextResponse.json(
      { ok: false, error: "Your Employee ID is not yet set up. Contact HR." },
      { status: 409 }
    );
  }
  if (manager.employeeId.toLowerCase() !== employeeId.toLowerCase()) {
    return NextResponse.json({ ok: false, error: "Employee ID does not match" }, { status: 403 });
  }

  const session = newSession(`manager:${id}`);
  const store = await cookies();
  store.set(COOKIE_NAME, session.token, { ...COOKIE_OPTIONS, maxAge: session.maxAge });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  return NextResponse.json({ ok: true });
}
