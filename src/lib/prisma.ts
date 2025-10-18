import { PrismaClient } from '@prisma/client';

// Singleton pattern for Prisma Client to prevent multiple connections
class PrismaService {
  private static instance: PrismaService;
  private prisma: PrismaClient;

  private constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
      errorFormat: process.env.NODE_ENV === 'development' ? 'pretty' : 'minimal',
    });

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

// Export singleton instance
const prismaService = PrismaService.getInstance();
export const prisma = prismaService.getClient();
export default prismaService;

// In development, prevent hot reload from creating new instances
if (process.env.NODE_ENV === 'development') {
  if (!(global as any).prisma) {
    (global as any).prisma = prisma;
  }
}