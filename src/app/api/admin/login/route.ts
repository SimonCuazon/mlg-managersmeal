import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { COOKIE_NAME, COOKIE_OPTIONS, newSession } from "@/lib/auth";

export const runtime = "nodejs";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

type Body = { password?: string };

export async function POST(req: Request) {
  if (!ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: "Admin login not configured" }, { status: 503 });
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const given = body.password ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(ADMIN_PASSWORD);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "Incorrect password" }, { status: 403 });
  }
  const session = newSession("admin");
  const store = await cookies();
  store.set(COOKIE_NAME, session.token, { ...COOKIE_OPTIONS, maxAge: session.maxAge });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  return NextResponse.json({ ok: true });
}
