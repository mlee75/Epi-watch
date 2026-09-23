import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { isGoogleConfigured } from '@/auth';
import { AuthForm } from '@/app/signin/AuthForm';

export const metadata = { title: 'Create an account | Epi-watch' };

export default function SignUpPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <AuthForm mode="signup" googleEnabled={isGoogleConfigured} />
      </main>
      <Footer />
    </div>
  );
}
