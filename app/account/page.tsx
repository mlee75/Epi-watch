import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import prisma from '@/lib/db';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AccountPanel } from './AccountPanel';

export const metadata = { title: 'Your account | EPI-WATCH' };

// Reads the signed-in user, so it must never be prerendered or cached.
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) redirect('/signin');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    // Explicit select: passwordHash must never reach the client, so only its
    // presence is derived, below.
    select: {
      email: true,
      name: true,
      passwordHash: true,
      accounts: { select: { provider: true } },
    },
  });

  if (!user) redirect('/signin');

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-14">
        <AccountPanel
          email={user.email}
          name={user.name}
          hasPassword={Boolean(user.passwordHash)}
          providers={user.accounts.map((a) => a.provider)}
        />
      </main>
      <Footer />
    </div>
  );
}
