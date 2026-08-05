/**
 * Re-export of the single client defined in lib/db.ts.
 *
 * This module used to construct its own `new PrismaClient()`. Both files guard
 * the instance behind a global that is only assigned when
 * NODE_ENV !== 'production', so in production neither guard applied and the app
 * ran two independent clients — two connection pools against the same database,
 * for no benefit and against Neon's connection budget.
 *
 * Kept as a module rather than deleted so the existing `@/lib/prisma` import
 * path still resolves; both paths now reach the same instance.
 */
export { prisma, default } from './db';
