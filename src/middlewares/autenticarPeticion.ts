import { Request, Response, NextFunction } from 'express';
import { verificarTokenAcceso, PerfilToken } from '../utilitarios/tokensJwt';
import { bitacora } from '../utilitarios/bitacora';

export function autenticarPeticion(req: Request, res: Response, next: NextFunction) {
  const hdr = req.headers.authorization;
  if (!hdr || !hdr.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No autorizado' });
  }
  try {
    const token = hdr.slice(7);
    const payload = verificarTokenAcceso(token);
    (req as any).perfil = payload;
    next();
  } catch (error) {
    bitacora.warn('Token de acceso invalido', { ruta: req.url });
    return res.status(401).json({ message: 'Token invalido' });
  }
}

export function perfilDePeticion(req: Request): PerfilToken {
  return (req as any).perfil as PerfilToken;
}
