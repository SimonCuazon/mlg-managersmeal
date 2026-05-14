"use client";

export default function SignOutButton() {
  async function onClick() {
    await fetch("/api/admin/login", { method: "DELETE" });
    window.location.href = "/admin/login";
  }
  return (
    <button
      onClick={onClick}
      style={{
        background: "#FAFAFA",
        color: "#666",
        border: "1px solid #E0D5CF",
        borderRadius: 8,
        padding: "8px 14px",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      Sign out
    </button>
  );
}
