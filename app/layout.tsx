import type { Metadata } from 'next';
import * as Sentry from '@sentry/nextjs';
import './globals.css';
import { AIChat } from '@/components/AIChat';
import { Providers } from '@/components/Providers';
import { MotionRoot } from '@/components/motion/MotionRoot';

// A function rather than a static `metadata` export so Sentry's trace headers
// can be emitted per-request, linking server traces to browser errors. Next
// permits only one of `metadata` / `generateMetadata`, so this replaces it.
export function generateMetadata(): Metadata {
  return {
    ...baseMetadata,
    other: { ...Sentry.getTraceData() },
  };
}

const baseMetadata: Metadata = {
  title: 'Epi-watch — infectious disease outbreak tracker',
  description:
    'A public tracker of reported infectious disease outbreaks. Curated records from WHO, CDC, PAHO, UKHSA and UNICEF reporting, plus a daily automated ingest of public outbreak feeds.',
  keywords: [
    'disease outbreak', 'outbreak tracker', 'epidemiology', 'public health',
    'WHO disease outbreak news', 'CDC outbreaks', 'infectious disease',
  ],
  openGraph: {
    title: 'Epi-watch — infectious disease outbreak tracker',
    description: 'Reported infectious disease outbreaks, by country, severity and source.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the inline script below adds the "js" class
    // before React hydrates, so <html>'s class legitimately differs.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Scroll reveals hide content only when JavaScript can reveal it. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>
        <Providers>
          <MotionRoot />
          {children}
          {/* The assistant calls the Anthropic API. Without a key every question
              returned "AI service unavailable", so it was a broken control on
              every page; it now appears only when it can actually answer. */}
          {aiEnabled && <AIChat />}
        </Providers>
      </body>
    </html>
  );
}
