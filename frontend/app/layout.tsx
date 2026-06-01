import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ActionFlow — Meeting to Action",
  description: "Extract action items, decisions, and follow-ups from meeting transcripts",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
