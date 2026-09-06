import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { isGoogleConfigured } from '@/auth';
import { AuthForm } from './AuthForm';

export const metadata = { title: 'Sign in | EPI-WATCH' };

export default function SignInPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-14">
        <AuthForm mode="signin" googleEnabled={isGoogleConfigured} />
      </main>
      <Footer />
    </div>
  );
}
