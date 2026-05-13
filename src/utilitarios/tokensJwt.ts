import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';

export type PerfilToken = { sub: string; correo: string };

export function emitirTokenAcceso(payload: PerfilToken): string {
  const opciones: SignOptions = {
    expiresIn: config.jwtDuracionAcceso as any,
    algorithm: 'HS256'
  };
  return jwt.sign(payload, config.jwtFirma, opciones);
}

export function verificarTokenAcceso(token: string): PerfilToken {
  return jwt.verify(token, config.jwtFirma) as PerfilToken;
}

export function generarTokenRefresco() {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = calcularFirmaSha256(token);
  const ms = config.refreshDuracionDias * 86_400_000;
  const expiraEn = new Date(Date.now() + ms);
  return { token, hash, expiraEn };
}

export function calcularFirmaSha256(valor: string): string {
  return crypto.createHash('sha256').update(valor, 'utf8').digest('hex');
}
