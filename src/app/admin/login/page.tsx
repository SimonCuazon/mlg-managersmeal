import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const store = await cookies();
  const session = verifySession(store.get(COOKIE_NAME)?.value);
  if (session?.scope === "admin") redirect("/admin");

  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: 24, paddingTop: 80 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", color: "#888" }}>
          MLG MANAGER&apos;S MEAL
        </div>
        <h1 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 800, color: "#1A0000" }}>
          Accounting Admin
        </h1>
      </div>
      <LoginForm />
    </main>
  );
}
