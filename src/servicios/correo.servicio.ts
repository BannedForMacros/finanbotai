import nodemailer from 'nodemailer';
import { config } from '../config';
import { bitacora } from '../utilitarios/bitacora';

let transporterCache: nodemailer.Transporter | null = null;

function obtenerTransporter(): nodemailer.Transporter {
  if (transporterCache) return transporterCache;
  transporterCache = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass
    }
  });
  return transporterCache;
}

export class CorreoServicio {
  static async enviarRecuperacion(destinatario: string, token: string): Promise<void> {
    const enlace = `${config.appFrontendUrl}?token=${token}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <div style="background: linear-gradient(135deg, #0f5132 0%, #145c3d 100%); padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">FinanBotAI</h1>
          <p style="color: #d1fae5; margin: 4px 0 0 0;">Simulador Financiero Inteligente</p>
        </div>
        <div style="padding: 24px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-top: 0;">
          <h2 style="color: #0f5132; margin-top: 0;">Recuperacion de acceso</h2>
          <p>Recibimos una solicitud para restablecer la credencial de tu cuenta.</p>
          <p>Pulsa el siguiente boton para continuar:</p>
          <p style="text-align: center; margin: 32px 0;">
            <a href="${enlace}"
               style="background-color: #b8860b; color: #ffffff; padding: 14px 28px;
                      text-decoration: none; border-radius: 6px; font-weight: bold;
                      display: inline-block;">
              Restablecer credencial
            </a>
          </p>
          <p style="font-size: 12px; color: #6b7280;">
            Si el boton no funciona, copia y pega este enlace:<br>
            <span style="color: #0f5132;">${enlace}</span>
          </p>
          <p style="font-size: 12px; color: #6b7280;">Este enlace expira en 15 minutos.</p>
        </div>
      </div>
    `;

    try {
      await obtenerTransporter().sendMail({
        from: config.smtp.from,
        to: destinatario,
        subject: 'FinanBotAI: recuperacion de acceso',
        html
      });
    } catch (e) {
      bitacora.error('Error enviando correo de recuperacion', e);
      throw new Error('No se pudo enviar el correo de recuperacion');
    }
  }
}
