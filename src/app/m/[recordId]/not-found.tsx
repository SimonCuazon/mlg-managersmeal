export default function NotFound() {
  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
      <div
        style={{
          background: "#fff",
          border: "1px solid #E0D5CF",
          borderRadius: 12,
          padding: 24,
        }}
      >
        <div
          style={{
            display: "inline-block",
            background: "#FEE2E2",
            color: "#991B1B",
            fontSize: 11,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: 20,
          }}
        >
          UNKNOWN MANAGER
        </div>
        <h1 style={{ margin: "12px 0 8px", fontSize: 20, fontWeight: 800, color: "#1A0000" }}>
          QR not recognized
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "#666", lineHeight: 1.5 }}>
          This QR doesn&apos;t match any active manager record. Ask the manager to confirm their
          card, or contact HR to reissue.
        </p>
      </div>
    </main>
  );
}
