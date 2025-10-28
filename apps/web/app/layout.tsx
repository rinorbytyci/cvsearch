import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "CV Search",
  description: "AI-assisted resume search platform"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
            <h1>CV Search</h1>
            <ul style={{ display: "flex", gap: "1rem", listStyle: "none", margin: 0, padding: 0 }}>
              <li>
                <a href="/search">Search</a>
              </li>
              <li>
                <a href="/searches">Saved searches</a>
              </li>
            </ul>
          </nav>
        </header>
        <main>{children}</main>
        <footer>
          <small>&copy; {new Date().getFullYear()} CV Search</small>
        </footer>
      </body>
    </html>
  );
}
