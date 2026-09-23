import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import VideoIntelFeed from './VideoIntelFeed';

export const metadata = {
  title: 'Video | Epi-watch',
  description:
    'Outbreak briefings and field reports and news coverage from a fixed list of health-agency and newsroom channels.',
};

export default function VideosPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <VideoIntelFeed />
      </main>
      <Footer />
    </div>
  );
}
