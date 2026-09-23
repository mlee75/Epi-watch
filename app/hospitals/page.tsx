import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { fetchNhsn, fetchSari, fetchUk } from '@/lib/live/hospital';
import HospitalDashboard from './HospitalDashboard';

// Upstream fetches are cached for an hour (HOSPITAL_REVALIDATE); the page is
// regenerated on the same cycle.
export const revalidate = 3600;
export const maxDuration = 60;

export const metadata = {
  title: 'Hospital admissions | Epi-watch',
  description:
    'Severe acute respiratory infection admissions in about 90 countries (WHO FluID), US admissions by pathogen (CDC NHSN) and England admissions (UKHSA).',
};

export default async function HospitalsPage() {
  const [sari, nhsn, uk] = await Promise.all([fetchSari(), fetchNhsn(), fetchUk()]);
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <HospitalDashboard sari={sari} nhsn={nhsn} uk={uk} generatedAt={new Date().toISOString()} />
      </main>
      <Footer />
    </div>
  );
}
