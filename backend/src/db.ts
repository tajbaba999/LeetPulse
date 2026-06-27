import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { env } from "./env.js";

declare global {
  // eslint-disable-next-line vars-on-top
  var prismaGlobal: PrismaClient | undefined;
}

const prisma
  = globalThis.prismaGlobal
    ?? new PrismaClient({
      // eslint-disable-next-line node/no-process-env
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });

if (env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

export default prisma;
