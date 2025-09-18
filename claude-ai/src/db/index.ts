import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Connection for queries
export const queryClient = postgres(process.env.DATABASE_URL, {
  max: 1,
});

export const db = drizzle(queryClient, { schema });

// Separate connection for LISTEN (must be dedicated)
export const notificationClient = postgres(process.env.DATABASE_URL, {
  max: 1,
});

// Graceful shutdown
process.on('beforeExit', () => {
  queryClient.end();
  notificationClient.end();
});