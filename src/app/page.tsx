export default function Home() {
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
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#1A0000" }}>
          MLG Manager&apos;s Meal Monitoring
        </h1>
        <p style={{ marginTop: 12, marginBottom: 0, fontSize: 14, color: "#666", lineHeight: 1.5 }}>
          Cashiers: scan the manager&apos;s QR card to log a meal. This URL is the entry
          point for QR-scanned forms — open <code>/m/&lt;record-id&gt;</code> directly to test.
        </p>
      </div>
    </main>
  );
}
