import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

const prisma
  = globalThis.prismaGlobal
    ?? new PrismaClient({
      // eslint-disable-next-line node/no-process-env
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

export default prisma;
