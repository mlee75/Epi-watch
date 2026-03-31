import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import LiveNewsFeed from './LiveNewsFeed';

export const metadata = {
  title: 'Live Outbreak News | EPI-WATCH',
  description: 'Real-time outbreak news, official reports, and field updates from WHO, CDC, ProMED, and global media.',
};

export default function NewsPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-14">
        <LiveNewsFeed />
      </main>
      <Footer />
    </div>
  );
}
