import { randomBytes } from 'crypto';
import { ejecutarSql } from '../datos';
import { cifrarCredencial, compararCredencial } from '../utilitarios/seguridad';
import {
  emitirTokenAcceso,
  generarTokenRefresco,
  calcularFirmaSha256
} from '../utilitarios/tokensJwt';
import { CorreoServicio } from './correo.servicio';

interface PerfilFila {
  id: string;
  correo_corporativo: string;
  identificador_acceso: string | null;
  nombres_completos: string;
  hash_credencial: string;
  perfil_activo: boolean;
}

interface InfoSesion {
  agente_dispositivo?: string | null;
  ip_origen?: string | null;
}

export interface RespuestaSesion {
  access_token: string;
  refresh_token: string;
  perfil: {
    id: string;
    correo_corporativo: string;
    nombres_completos: string;
    identificador_acceso: string | null;
  };
}

export class AutenticacionServicio {
  static async registrar(
    datos: {
      correo_corporativo: string;
      nombres_completos: string;
      identificador_acceso?: string;
      credencial: string;
    },
    info: InfoSesion = {}
  ): Promise<RespuestaSesion> {
    const existe = await ejecutarSql<{ id: string }>(
      `SELECT id FROM intelfin.perfil_corporativo WHERE correo_corporativo = $1`,
      [datos.correo_corporativo]
    );
    if (existe.rows.length) {
      const err: any = new Error('Correo ya registrado');
      err.status = 409;
      throw err;
    }

    const hash = await cifrarCredencial(datos.credencial);
    const { rows } = await ejecutarSql<PerfilFila>(
      `INSERT INTO intelfin.perfil_corporativo
        (correo_corporativo, identificador_acceso, nombres_completos, hash_credencial)
       VALUES ($1, $2, $3, $4)
       RETURNING id, correo_corporativo, identificador_acceso, nombres_completos, hash_credencial, perfil_activo`,
      [datos.correo_corporativo, datos.identificador_acceso ?? null, datos.nombres_completos, hash]
    );
    const perfil = rows[0];

    return this.construirSesion(perfil, info);
  }

  static async iniciarSesion(
    datos: { correo_corporativo: string; credencial: string },
    info: InfoSesion = {}
  ): Promise<RespuestaSesion> {
    const { rows } = await ejecutarSql<PerfilFila>(
      `SELECT id, correo_corporativo, identificador_acceso, nombres_completos, hash_credencial, perfil_activo
         FROM intelfin.perfil_corporativo
        WHERE correo_corporativo = $1`,
      [datos.correo_corporativo]
    );
    const perfil = rows[0];
    if (!perfil || !perfil.perfil_activo) {
      const err: any = new Error('Credenciales invalidas');
      err.status = 401;
      throw err;
    }
    const ok = await compararCredencial(perfil.hash_credencial, datos.credencial);
    if (!ok) {
      const err: any = new Error('Credenciales invalidas');
      err.status = 401;
      throw err;
    }
    return this.construirSesion(perfil, info);
  }

  static async refrescar(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
    const firmaEntrante = calcularFirmaSha256(refreshToken);

    const { rows } = await ejecutarSql<{ id: string; perfil_id: string }>(
      `SELECT id, perfil_id
         FROM intelfin.sesiones_token_jwt
        WHERE firma_refresh = $1
          AND invalidada_en IS NULL
          AND expira_en > NOW()
        LIMIT 1`,
      [firmaEntrante]
    );
    const sesion = rows[0];
    if (!sesion) {
      const err: any = new Error('Refresh invalido');
      err.status = 401;
      throw err;
    }

    const nuevo = generarTokenRefresco();
    await ejecutarSql(
      `UPDATE intelfin.sesiones_token_jwt
          SET firma_refresh = $1,
              expira_en = $2
        WHERE id = $3`,
      [nuevo.hash, nuevo.expiraEn, sesion.id]
    );

    const { rows: perfilRows } = await ejecutarSql<{ correo_corporativo: string }>(
      `SELECT correo_corporativo FROM intelfin.perfil_corporativo WHERE id = $1`,
      [sesion.perfil_id]
    );
    const access = emitirTokenAcceso({
      sub: sesion.perfil_id,
      correo: perfilRows[0].correo_corporativo
    });

    return { access_token: access, refresh_token: nuevo.token };
  }

  static async cerrarSesion(refreshToken: string): Promise<void> {
    const firma = calcularFirmaSha256(refreshToken);
    await ejecutarSql(
      `UPDATE intelfin.sesiones_token_jwt
          SET invalidada_en = NOW()
        WHERE firma_refresh = $1 AND invalidada_en IS NULL`,
      [firma]
    );
  }

  static async perfilPorId(id: string) {
    const { rows } = await ejecutarSql<{
      id: string;
      correo_corporativo: string;
      identificador_acceso: string | null;
      nombres_completos: string;
      registrado_en: string;
    }>(
      `SELECT id, correo_corporativo, identificador_acceso, nombres_completos, registrado_en
         FROM intelfin.perfil_corporativo
        WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  static async solicitarRecuperacion(correo: string): Promise<void> {
    const { rows } = await ejecutarSql<{ id: string }>(
      `SELECT id FROM intelfin.perfil_corporativo WHERE correo_corporativo = $1`,
      [correo]
    );
    const perfil = rows[0];
    if (!perfil) return;

    const token = randomBytes(32).toString('hex');
    const firma = calcularFirmaSha256(token);
    const expiraEn = new Date(Date.now() + 15 * 60 * 1000);

    await ejecutarSql(
      `INSERT INTO intelfin.recuperaciones_acceso (perfil_id, firma_token, expira_en)
       VALUES ($1, $2, $3)`,
      [perfil.id, firma, expiraEn]
    );

    await CorreoServicio.enviarRecuperacion(correo, token);
  }

  static async restablecerAcceso(token: string, nuevaCredencial: string): Promise<void> {
    const firma = calcularFirmaSha256(token);

    const { rows } = await ejecutarSql<{ perfil_id: string }>(
      `SELECT perfil_id
         FROM intelfin.recuperaciones_acceso
        WHERE firma_token = $1
          AND expira_en > NOW()
          AND consumida_en IS NULL`,
      [firma]
    );
    const recuperacion = rows[0];
    if (!recuperacion) {
      const err: any = new Error('El token es invalido o ha expirado');
      err.status = 400;
      throw err;
    }

    const hash = await cifrarCredencial(nuevaCredencial);

    await ejecutarSql(
      `UPDATE intelfin.perfil_corporativo
          SET hash_credencial = $1, modificado_en = NOW()
        WHERE id = $2`,
      [hash, recuperacion.perfil_id]
    );

    await ejecutarSql(
      `UPDATE intelfin.recuperaciones_acceso SET consumida_en = NOW() WHERE firma_token = $1`,
      [firma]
    );

    await ejecutarSql(
      `UPDATE intelfin.sesiones_token_jwt SET invalidada_en = NOW() WHERE perfil_id = $1 AND invalidada_en IS NULL`,
      [recuperacion.perfil_id]
    );
  }

  private static async construirSesion(perfil: PerfilFila, info: InfoSesion): Promise<RespuestaSesion> {
    const refresh = generarTokenRefresco();
    await ejecutarSql(
      `INSERT INTO intelfin.sesiones_token_jwt
        (perfil_id, firma_refresh, agente_dispositivo, ip_origen, expira_en)
       VALUES ($1, $2, $3, $4, $5)`,
      [perfil.id, refresh.hash, info.agente_dispositivo ?? null, info.ip_origen ?? null, refresh.expiraEn]
    );

    const access = emitirTokenAcceso({
      sub: perfil.id,
      correo: perfil.correo_corporativo
    });

    return {
      access_token: access,
      refresh_token: refresh.token,
      perfil: {
        id: perfil.id,
        correo_corporativo: perfil.correo_corporativo,
        nombres_completos: perfil.nombres_completos,
        identificador_acceso: perfil.identificador_acceso
      }
    };
  }
}
