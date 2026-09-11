import { PrismaClient } from '@prisma/client';

// Handle BigInt serialization for Next.js Server Actions
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const globalForPrisma = global as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
