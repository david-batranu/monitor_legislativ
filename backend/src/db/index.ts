import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzleLocal } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const getDb = (databaseUrl: string) => {
  if (databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')) {
    const queryClient = postgres(databaseUrl);
    return drizzleLocal(queryClient, { schema });
  }
  const sql = neon(databaseUrl);
  return drizzleNeon(sql, { schema });
};
