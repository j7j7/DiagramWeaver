import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RecentColorsProvider } from "@/hooks/use-recent-colors";
import { ThemeProvider } from "@/components/theme-provider";
import { CONTENT_SECURITY_POLICY } from "@/lib/content-security-policy";
import { inter, nunito } from "@/lib/app-fonts";

export const metadata: Metadata = {
  title: 'Diagram Weaver',
  description: 'Create interactive diagrams from JSON or natural language.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.svg',
    apple: '/pwa/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    title: 'Diagram Weaver',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${nunito.variable}`}>
      <head>
        <meta httpEquiv="Content-Security-Policy" content={CONTENT_SECURITY_POLICY} />
        {/* External file avoids next/script innerHTML + __next_s wrapper (server/client mismatch). */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- small static boot script; next/script adds hydration wrapper */}
        <script src="/theme-init.js" suppressHydrationWarning />
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- PWA registration; same pattern as theme-init */}
        <script src="/pwa-register.js" suppressHydrationWarning />
      </head>
      {/*
        Avoid `overflow-hidden` on body: Chromium can treat it as a backdrop root and affect
        `backdrop-filter` in descendants. Rely on the app shell for clipping (e.g. diagram-editor).
        Mobile globals may still set `overflow-x: hidden` on body — desktop stays overflow visible.
      */}
      <body className="font-body antialiased h-dvh min-h-0 w-full">
        <ThemeProvider>
          <TooltipProvider>
            <RecentColorsProvider>
              {children}
              <Toaster />
            </RecentColorsProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
