import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Styled — your wedding, in your venue, bookable",
  description:
    "Upload your venue, choose a style, and see it come to life with real, priced items from local suppliers — bookable in one place.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        <header className="border-b border-sand bg-cream/80 backdrop-blur sticky top-0 z-30">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
            <Link href="/clients" className="font-serif text-2xl tracking-wide text-ink">
              Styled<span className="text-clay">.</span>
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              <Link href="/clients" className="text-ink/70 hover:text-ink">
                Weddings
              </Link>
              <Link href="/plan" className="text-ink/50 hover:text-ink">
                Design studio
              </Link>
              <Link href="/admin" className="text-ink/50 hover:text-ink">
                Admin
              </Link>
              <Link
                href="/clients"
                className="rounded-full bg-ink px-4 py-2 text-cream hover:bg-ink/90"
              >
                Open workspace
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5">{children}</main>
        <footer className="mt-20 border-t border-sand py-8 text-center text-xs text-ink/40">
          Proof of concept · Essex · Herts · London fringe · Renders are
          illustrative. Prices are working estimates.
        </footer>
      </body>
    </html>
  );
}
