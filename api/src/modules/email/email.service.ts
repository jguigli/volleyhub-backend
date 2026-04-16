import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly appUrl: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('app.email.resendApiKey');
    this.from =
      this.config.get<string>('app.email.from') ??
      'VolleyHub <noreply@volleyhub.app>';
    this.appUrl =
      this.config.get<string>('app.appUrl') ?? 'http://localhost:3000';
    this.resend = apiKey ? new Resend(apiKey) : null;
    if (!this.resend) {
      this.logger.warn('Resend not configured — emails disabled');
    }
  }

  async sendPasswordResetEmail(
    to: string,
    username: string,
    code: string,
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `Email skipped (no API key): password reset for ${to} (code=${code})`,
      );
      return;
    }
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject: `Ton code VolleyHub : ${code}`,
        html: `
          <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 0 auto; background: #0b1017; color: #f1f5f9; padding: 32px; border-radius: 16px;">
            <h2 style="color: #22d3ee; margin-top: 0;">Réinitialisation de mot de passe</h2>
            <p>Salut ${username},</p>
            <p>Voici ton code à entrer dans l'application VolleyHub pour réinitialiser ton mot de passe :</p>
            <div style="text-align: center; margin: 32px 0;">
              <div style="display: inline-block; background: #22d3ee; color: #0b1017; padding: 20px 40px; border-radius: 12px; font-size: 36px; font-weight: 800; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                ${code}
              </div>
            </div>
            <p>Ce code est valide pendant <strong>15 minutes</strong>.</p>
            <p style="color:#94a3b8;">Si tu n'as pas demandé cette réinitialisation, ignore simplement cet email. Personne d'autre ne peut accéder à ton compte sans ce code.</p>
            <p style="color:#64748b;font-size:12px;margin-top:32px;border-top:1px solid #2d3a4d;padding-top:16px;">
              L'équipe VolleyHub
            </p>
          </div>
        `,
      });
      this.logger.log(`Password reset code sent to ${to}`);
    } catch (err) {
      this.logger.error(
        `Failed to send password reset email to ${to}: ${String(err)}`,
      );
    }
  }
}
