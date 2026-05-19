import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RecentColorsProvider } from "@/hooks/use-recent-colors";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: 'Diagram Weaver',
  description: 'Create interactive diagrams from JSON or natural language.',
  icons: {
    icon: '/favicon.svg',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* External file avoids next/script innerHTML + __next_s wrapper (server/client mismatch). */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- small static boot script; next/script adds hydration wrapper */}
        <script src="/theme-init.js" suppressHydrationWarning />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
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
