import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import LiveNewsFeed from './LiveNewsFeed';

export const metadata = {
  title: 'Outbreak news | Epi-watch',
  description: 'Recent infectious disease outbreak coverage, grouped by publisher type: health agencies, field organisations and media.',
};

export default function NewsPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <LiveNewsFeed />
      </main>
      <Footer />
    </div>
  );
}
