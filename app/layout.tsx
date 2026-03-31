import type { Metadata } from 'next';
import { Space_Grotesk, Space_Mono } from 'next/font/google';
import './globals.css';
import { AIChat } from '@/components/AIChat';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Epi-Watch — Global Disease Outbreak Intelligence',
  description:
    'Real-time global disease outbreak monitoring. Track, classify, and visualize infectious disease events worldwide with data from WHO, CDC, ECDC, and ProMED.',
  keywords: [
    'disease outbreak', 'epidemic monitoring', 'public health intelligence',
    'WHO alerts', 'CDC outbreaks', 'pandemic watch', 'infectious disease tracker',
  ],
  openGraph: {
    title: 'Epi-Watch — Global Disease Outbreak Intelligence',
    description: 'Real-time surveillance of disease outbreaks worldwide.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${spaceMono.variable}`}>
      <body className="text-white antialiased">
        {children}
        <AIChat />
      </body>
    </html>
  );
}
