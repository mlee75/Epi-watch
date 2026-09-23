import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { fetchAlerts } from '@/lib/live/alerts';
import AlertsFeed from './AlertsFeed';

// Matches ALERTS_REVALIDATE: feeds are re-read at most every 30 minutes.
export const revalidate = 1800;
export const maxDuration = 60;

export const metadata = {
  title: 'Official alerts | Epi-watch',
  description:
    'Outbreak notices from WHO, ECDC, PAHO and CDC, and alerts from national health authorities in their original language.',
};

export default async function AlertsPage() {
  const data = await fetchAlerts();
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <AlertsFeed data={data} />
      </main>
      <Footer />
    </div>
  );
}
