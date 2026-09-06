import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';

import prisma from '@/lib/db';
import { normalizeEmail, verifyPassword } from '@/lib/password';

/**
 * Auth.js configuration.
 *
 * Google is registered only when its credentials are present, so the app boots
 * and email sign-in keeps working before Google OAuth has been set up — the
 * client ID and secret have to be created by hand in Google Cloud Console.
 */
const googleConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID) && Boolean(process.env.GOOGLE_CLIENT_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),

  // JWT rather than database sessions: the credentials provider cannot use
  // database sessions in Auth.js v5, and this avoids a database round trip on
  // every request to a site that is mostly anonymous reads.
  session: { strategy: 'jwt' },

  pages: {
    signIn: '/signin',
    error: '/signin',
  },

  providers: [
    ...(googleConfigured
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: false,
          }),
        ]
      : []),

    Credentials({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === 'string' ? normalizeEmail(credentials.email) : '';
        const password = typeof credentials?.password === 'string' ? credentials.password : '';

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });

        // verifyPassword runs a bcrypt comparison even when the user is absent
        // or has no password, so a missing account cannot be distinguished from
        // a wrong password by response time.
        const ok = await verifyPassword(password, user?.passwordHash);
        if (!ok || !user) return null;

        // Only non-sensitive fields are returned; passwordHash never leaves the
        // server boundary.
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        (session.user as { id?: string }).id = token.uid as string;
      }
      return session;
    },
  },

  trustHost: true,
});

export const isGoogleConfigured = googleConfigured;
