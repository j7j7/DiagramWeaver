import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RecentColorsProvider } from "@/hooks/use-recent-colors";

export const metadata: Metadata = {
  title: 'Diagram Weaver',
  description: 'Create interactive diagrams from JSON or natural language.',
  icons: {
    icon: '/icon',
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased overflow-hidden">
        <TooltipProvider>
          <RecentColorsProvider>
            {children}
            <Toaster />
          </RecentColorsProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
