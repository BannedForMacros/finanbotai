import { Router } from 'express';
import { ejecutarSql } from '../datos';

const router = Router();

/**
 * @openapi
 * /api/catalogo/arancelario:
 *   get:
 *     tags: [Catalogo]
 *     summary: Busqueda de partidas arancelarias por codigo o descripcion.
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 */
router.get('/arancelario', async (req, res) => {
  const q = (req.query.q as string) || '';
  const limit = Math.min(Number(req.query.limit) || 20, 100);

  const qLimpio = q.replace(/\./g, '');
  let sql = `
    SELECT codigo_arancelario, descripcion_oficial
      FROM intelfin.catalogo_arancelario
     WHERE activo = true
  `;
  const params: any[] = [];
  if (qLimpio) {
    sql += ` AND (codigo_arancelario LIKE $1 OR descripcion_oficial ILIKE $2)`;
    params.push(`${qLimpio}%`, `%${q}%`);
  }
  sql += ` ORDER BY codigo_arancelario LIMIT $${params.length + 1}`;
  params.push(limit);

  const { rows } = await ejecutarSql<{ codigo_arancelario: string; descripcion_oficial: string }>(sql, params);
  const data = rows.map((r) => {
    const c = r.codigo_arancelario;
    const formato = `${c.slice(0, 2)}.${c.slice(2, 4)}.${c.slice(4, 6)}.${c.slice(6, 8)}.${c.slice(8, 10)}`;
    return {
      value: r.codigo_arancelario,
      label: `${formato} - ${r.descripcion_oficial}`,
      codigo: r.codigo_arancelario,
      codigo_fmt: formato,
      descripcion: r.descripcion_oficial
    };
  });
  return res.json({ data });
});

/**
 * @openapi
 * /api/catalogo/advalorem:
 *   get:
 *     tags: [Catalogo]
 *     summary: Devuelve la tasa Ad Valorem (en decimal 0..1) para un codigo arancelario.
 *     parameters:
 *       - in: query
 *         name: codigo
 *         required: true
 *         schema: { type: string }
 */
router.get('/advalorem', async (req, res) => {
  const codigo = (req.query.codigo as string) || '';
  if (codigo.length !== 10) {
    return res.status(400).json({ message: 'codigo debe tener 10 digitos' });
  }
  const { rows } = await ejecutarSql<{ tasa_porcentual: string }>(
    `SELECT tasa_porcentual FROM intelfin.tasas_advalorem_intelfin WHERE codigo_arancelario = $1`,
    [codigo]
  );
  if (rows.length === 0) return res.status(404).json({ message: 'Codigo no encontrado' });
  return res.json({ codigo, tasa: parseFloat(rows[0].tasa_porcentual) / 100 });
});

export default router;
