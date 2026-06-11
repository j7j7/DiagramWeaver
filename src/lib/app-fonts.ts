import { Inter, Nunito } from 'next/font/google';

/** Self-hosted via `next/font` so PNG export can embed same-origin `@font-face` rules. */
export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});
