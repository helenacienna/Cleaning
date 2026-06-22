const globalForPrisma = globalThis;

export async function getPrisma() {
  if (globalForPrisma.prisma !== undefined) {
    return globalForPrisma.prisma;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    return null;
  }

  const [{ Pool }, { PrismaPg }, { PrismaClient }] = await Promise.all([
    import('pg'),
    import('@prisma/adapter-pg'),
    import('@prisma/client'),
  ]);

  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  globalForPrisma.prisma = prisma;

  return prisma;
}
