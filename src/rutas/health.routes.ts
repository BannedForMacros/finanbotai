import { Router } from 'express';
import { pingDatos, ejecutarSql } from '../datos';

const router = Router();

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: Health check de la API y la base de datos
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/', async (_req, res) => {
  try {
    const ok = await pingDatos();
    const { rows } = await ejecutarSql<{ current_database: string; current_schema: string }>(
      `SELECT current_database()::text AS current_database, current_schema()::text AS current_schema`
    );
    return res.json({
      ok,
      api: 'finanbotai-server',
      current_database: rows[0]?.current_database,
      current_schema: rows[0]?.current_schema,
      timestamp: new Date().toISOString()
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e.message });
  }
});

export default router;
