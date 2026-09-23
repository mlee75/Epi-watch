import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { isGoogleConfigured } from '@/auth';
import { AuthForm } from './AuthForm';

export const metadata = { title: 'Sign in | Epi-watch' };

export default function SignInPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <AuthForm mode="signin" googleEnabled={isGoogleConfigured} />
      </main>
      <Footer />
    </div>
  );
}
