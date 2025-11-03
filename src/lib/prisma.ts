import { PrismaClient } from '@prisma/client';

// Singleton pattern for Prisma Client to prevent multiple connections
class PrismaService {
  private static instance: PrismaService;
  private prisma: PrismaClient;

  private constructor() {
    const basePrisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
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

    // Handle connection errors
    this.prisma.$connect()
      .then(() => {
        console.log('✅ Database connected successfully');
      })
      .catch((error) => {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
      });

    // Graceful shutdown
    process.on('SIGINT', this.shutdown.bind(this));
    process.on('SIGTERM', this.shutdown.bind(this));
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
    console.log('Shutting down database connection...');
    await this.prisma.$disconnect();
    process.exit(0);
  }

  // Connection health check
  public async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
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
