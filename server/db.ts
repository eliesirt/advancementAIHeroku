import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Optimize connection pool for production performance
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 8000, // 8 second connection timeout
  idleTimeoutMillis: 30000, // 30 second idle timeout
  max: 10, // Maximum 10 connections
  statement_timeout: 10000, // 10 second statement timeout
  query_timeout: 10000 // 10 second query timeout
});

export const db = drizzle({ client: pool, schema });