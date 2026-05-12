import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "MLG Manager's Meal",
  description: "Internal meal credit logging for MLG Hospitality managers.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#8B0000",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          background: "#F5F0EE",
          color: "#1A0000",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
