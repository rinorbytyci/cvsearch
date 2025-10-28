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
          <nav>
            <h1>CV Search</h1>
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
