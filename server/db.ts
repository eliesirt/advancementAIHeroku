import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "../shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Use postgres-js for Heroku Postgres compatibility
// Always use SSL for production databases (Heroku requires SSL)
const databaseUrl = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === 'production';

const sql = postgres(databaseUrl, {
  ssl: isProduction ? { rejectUnauthorized: false } : (databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : false),
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10
});

export const db = drizzle(sql, { schema });