import { Pool, QueryResultRow, types } from 'pg';
import { config } from './config';

// Mantenemos el campo DATE (OID 1082) como string "YYYY-MM-DD"
// para evitar desfases de zona horaria (Peru UTC-5).
types.setTypeParser(1082, (val: string) => val);

const pool = config.databaseUrl
  ? new Pool({
      connectionString: config.databaseUrl,
      ssl: config.pgSsl ? { rejectUnauthorized: false } : undefined
    })
  : new Pool({
      host: config.pg.host,
      port: config.pg.port,
      user: config.pg.user,
      password: config.pg.password,
      database: config.pg.database,
      ssl: config.pgSsl ? { rejectUnauthorized: false } : undefined
    });

export async function ejecutarSql<T extends QueryResultRow>(
  text: string,
  params?: any[]
): Promise<{ rows: T[] }> {
  const cliente = await pool.connect();
  try {
    const res = await cliente.query<T>(text, params);
    return { rows: res.rows };
  } finally {
    cliente.release();
  }
}

export async function pingDatos(): Promise<boolean> {
  const { rows } = await ejecutarSql<{ uno: number }>('SELECT 1 AS uno');
  return rows[0]?.uno === 1;
}
