import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { isGoogleConfigured } from '@/auth';
import { AuthForm } from '@/app/signin/AuthForm';

export const metadata = { title: 'Create account | EPI-WATCH' };

export default function SignUpPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-14">
        <AuthForm mode="signup" googleEnabled={isGoogleConfigured} />
      </main>
      <Footer />
    </div>
  );
}
