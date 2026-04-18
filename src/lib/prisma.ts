import { Prisma, PrismaClient } from '@prisma/client';

// Singleton pattern for Prisma Client to prevent multiple connections
class PrismaService {
  private static instance: PrismaService;
  private prisma: PrismaClient;

  private constructor() {
    const validLogLevels: Prisma.LogLevel[] = ['query', 'info', 'warn', 'error'];
    let logLevels: Prisma.LogLevel[] = process.env.PRISMA_LOG
      ? process.env.PRISMA_LOG.split(',')
          .filter((level): level is Prisma.LogLevel => validLogLevels.includes(level as Prisma.LogLevel))
      : ['warn', 'error'];

    // Defense-in-depth: `query` log level prints every Prisma query with its
    // parameters to stdout - including user emails, password hashes during
    // auth queries, payment details, etc. In production, stdout flows to
    // CloudWatch (queryable, retained). An operator enabling PRISMA_LOG=query
    // to debug a slow query would silently leak PII. Drop it in prod.
    if (process.env.NODE_ENV === 'production' && logLevels.includes('query')) {
      console.warn('PRISMA_LOG=query is not allowed in production (PII leak risk); dropping query level');
      logLevels = logLevels.filter(l => l !== 'query');
    }

    const basePrisma = new PrismaClient({
      log: logLevels,
      errorFormat: process.env.NODE_ENV === 'development' ? 'pretty' : 'minimal',
    });

    // Extend Prisma to automatically exclude password from User queries
    this.prisma = basePrisma.$extends({
      query: {
        user: {
          async findUnique({ args, query }) {
            if (!args.select) {
              // If no select clause, add one that excludes password
              args.select = {
                id: true,
                name: true,
                username: true,
                displayUsername: true,
                email: true,
                emailVerified: true,
                phoneNumber: true,
                image: true,
                role: true,
                status: true,
                gender: true,
                dateOfBirth: true,
                area: true,
                bio: true,
                createdAt: true,
                updatedAt: true,
                lastLogin: true,
                lastActivityCheck: true,
                completedOnboarding: true,
                // password explicitly excluded
              };
            }
            return query(args);
          },
          async findFirst({ args, query }) {
            if (!args.select) {
              args.select = {
                id: true,
                name: true,
                username: true,
                displayUsername: true,
                email: true,
                emailVerified: true,
                phoneNumber: true,
                image: true,
                role: true,
                status: true,
                gender: true,
                dateOfBirth: true,
                area: true,
                bio: true,
                createdAt: true,
                updatedAt: true,
                lastLogin: true,
                lastActivityCheck: true,
                completedOnboarding: true,
              };
            }
            return query(args);
          },
          async findMany({ args, query }) {
            if (!args.select) {
              args.select = {
                id: true,
                name: true,
                username: true,
                displayUsername: true,
                email: true,
                emailVerified: true,
                phoneNumber: true,
                image: true,
                role: true,
                status: true,
                gender: true,
                dateOfBirth: true,
                area: true,
                bio: true,
                createdAt: true,
                updatedAt: true,
                lastLogin: true,
                lastActivityCheck: true,
                completedOnboarding: true,
              };
            }
            return query(args);
          },
        },
      },
    }) as unknown as PrismaClient;

    // Connect with retry + exponential backoff. Transient RDS unavailability
    // (failover, brief network blip, security group update) would otherwise
    // cause a crash loop: task exits -> ECS respawns -> task exits again.
    // Retries buy ~30s of resilience before giving up, enough to ride out
    // most transient issues without noise.
    void this.connectWithRetry();

    // Graceful shutdown
    process.on('SIGINT', this.shutdown.bind(this));
    process.on('SIGTERM', this.shutdown.bind(this));
  }

  private async connectWithRetry(attempts = 5): Promise<void> {
    for (let i = 0; i < attempts; i++) {
      try {
        await this.prisma.$connect();
        return;
      } catch (error) {
        if (i === attempts - 1) {
          console.error('Database connection failed after retries:', error);
          process.exit(1);
        }
        const delay = Math.min(30_000, 1000 * Math.pow(2, i));
        console.warn(`DB connect attempt ${i + 1}/${attempts} failed, retrying in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  public static getInstance(): PrismaService {
    if (!PrismaService.instance) {
      PrismaService.instance = new PrismaService();
    }
    return PrismaService.instance;
  }

  public getClient(): PrismaClient {
    return this.prisma;
  }

  private async shutdown() {
    await this.prisma.$disconnect();
    process.exit(0);
  }

  // Connection health check
  public async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  // Transaction helper
  public async transaction<T>(
    fn: (prisma: PrismaClient) => Promise<T>
  ): Promise<T> {
    return this.prisma.$transaction(async (prisma) => {
      return fn(prisma as PrismaClient);
    });
  }

  // Query with timeout
  public async queryWithTimeout<T>(
    query: Promise<T>,
    timeoutMs: number = 5000
  ): Promise<T> {
    return Promise.race([
      query,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
      ),
    ]);
  }
}

// Export singleton instance with global caching for both dev and prod
const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? PrismaService.getInstance().getClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

const prismaService = PrismaService.getInstance();
export default prismaService;

// Re-export PrismaClient type for dependency injection
export { PrismaClient } from '@prisma/client'; 
