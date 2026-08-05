import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import VideoIntelFeed from './VideoIntelFeed';

export const metadata = {
  title: 'Verified Video Intelligence | EPI-WATCH',
  description:
    'Outbreak briefings and field reports published by public health authorities including WHO, CDC and PAHO, sourced from an explicit channel allowlist.',
};

export default function VideosPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-14">
        <VideoIntelFeed />
      </main>
      <Footer />
    </div>
  );
}
