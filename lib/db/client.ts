/**
 * PostgreSQL Database Client
 */

import { Pool } from 'pg';

// Extend the global type to include our pool
declare global {
  var postgresPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!global.postgresPool) {
    const connectionString = process.env.HIM_WELLNESS_TTDI_DB_DDL || process.env.HIM_WELLNESS_TTDI_DB;

    if (!connectionString) {
      throw new Error('Database connection string not found in environment variables');
    }

    global.postgresPool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  return global.postgresPool;
}
