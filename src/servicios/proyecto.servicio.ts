import { ejecutarSql } from '../datos';

export interface ProyectoFila {
  id: string;
  perfil_id: string;
  nombre_proyecto: string;
  descripcion_proyecto: string | null;
  estado_proyecto: string;
  creado_en: string;
  modificado_en: string;
}

export class ProyectoServicio {
  static async listar(perfilId: string, soloAbiertos = false): Promise<ProyectoFila[]> {
    const condicionEstado = soloAbiertos
      ? `AND estado_proyecto = 'en_curso'`
      : `AND estado_proyecto <> 'archivado'`;
    const { rows } = await ejecutarSql<ProyectoFila>(
      `SELECT id, perfil_id, nombre_proyecto, descripcion_proyecto, estado_proyecto,
              creado_en, modificado_en
         FROM intelfin.proyectos_analisis
        WHERE perfil_id = $1 ${condicionEstado}
        ORDER BY creado_en DESC`,
      [perfilId]
    );
    return rows;
  }

  static async obtener(id: string, perfilId: string): Promise<ProyectoFila | null> {
    const { rows } = await ejecutarSql<ProyectoFila>(
      `SELECT id, perfil_id, nombre_proyecto, descripcion_proyecto, estado_proyecto,
              creado_en, modificado_en
         FROM intelfin.proyectos_analisis
        WHERE id = $1 AND perfil_id = $2 AND estado_proyecto <> 'archivado'`,
      [id, perfilId]
    );
    return rows[0] || null;
  }

  static async crear(
    perfilId: string,
    datos: { nombre_proyecto: string; descripcion_proyecto?: string }
  ): Promise<ProyectoFila> {
    const { rows } = await ejecutarSql<ProyectoFila>(
      `INSERT INTO intelfin.proyectos_analisis
        (perfil_id, nombre_proyecto, descripcion_proyecto)
       VALUES ($1, $2, $3)
       RETURNING id, perfil_id, nombre_proyecto, descripcion_proyecto, estado_proyecto,
                 creado_en, modificado_en`,
      [perfilId, datos.nombre_proyecto, datos.descripcion_proyecto ?? null]
    );
    return rows[0];
  }

  static async actualizar(
    id: string,
    perfilId: string,
    datos: {
      nombre_proyecto?: string;
      descripcion_proyecto?: string;
      estado_proyecto?: 'en_curso' | 'cerrado' | 'archivado';
    }
  ): Promise<ProyectoFila | null> {
    const { rows } = await ejecutarSql<ProyectoFila>(
      `UPDATE intelfin.proyectos_analisis
          SET nombre_proyecto = COALESCE($1, nombre_proyecto),
              descripcion_proyecto = COALESCE($2, descripcion_proyecto),
              estado_proyecto = COALESCE($3, estado_proyecto),
              modificado_en = NOW()
        WHERE id = $4 AND perfil_id = $5
        RETURNING id, perfil_id, nombre_proyecto, descripcion_proyecto, estado_proyecto,
                  creado_en, modificado_en`,
      [
        datos.nombre_proyecto ?? null,
        datos.descripcion_proyecto ?? null,
        datos.estado_proyecto ?? null,
        id,
        perfilId
      ]
    );
    return rows[0] || null;
  }

  static async cerrar(id: string, perfilId: string): Promise<ProyectoFila | null> {
    return this.actualizar(id, perfilId, { estado_proyecto: 'cerrado' });
  }

  static async archivar(id: string, perfilId: string): Promise<boolean> {
    const { rows } = await ejecutarSql<{ id: string }>(
      `UPDATE intelfin.proyectos_analisis
          SET estado_proyecto = 'archivado', modificado_en = NOW()
        WHERE id = $1 AND perfil_id = $2 AND estado_proyecto <> 'archivado'
        RETURNING id`,
      [id, perfilId]
    );
    return rows.length > 0;
  }

  static async perteneceAPerfil(id: string, perfilId: string): Promise<boolean> {
    const { rows } = await ejecutarSql(
      `SELECT id FROM intelfin.proyectos_analisis
        WHERE id = $1 AND perfil_id = $2 AND estado_proyecto <> 'archivado'`,
      [id, perfilId]
    );
    return rows.length > 0;
  }
}
