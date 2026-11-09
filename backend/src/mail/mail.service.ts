import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

/**
 * Sends email through the Resend HTTP API (RESEND_API_KEY) or SMTP (SMTP_URL).
 * The API works on hosts that block outbound SMTP, such as Railway's Hobby plan.
 * With neither set, emails are only logged.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resendKey?: string;
  private readonly transport: Transporter | null = null;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.resendKey = config.get<string>('RESEND_API_KEY') || undefined;
    const smtpUrl = config.get<string>('SMTP_URL');
    if (!this.resendKey && smtpUrl) {
      this.transport = nodemailer.createTransport(smtpUrl);
    }
    this.from = config.get('MAIL_FROM', 'Project S <alerts@project-s.local>');
    if (!this.resendKey && !this.transport) {
      this.logger.warn(
        'Neither RESEND_API_KEY nor SMTP_URL is set; emails will only be logged',
      );
    }
  }

  async send(to: string, subject: string, text: string) {
    if (this.resendKey) return this.sendWithResend(to, subject, text);
    if (this.transport) {
      await this.transport.sendMail({ from: this.from, to, subject, text });
      return;
    }
    this.logger.log(`[mail disabled] to=${to} subject="${subject}"\n${text}`);
  }

  private async sendWithResend(to: string, subject: string, text: string) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: this.from, to: [to], subject, text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      throw new Error(`Resend API returned ${res.status}: ${await res.text()}`);
    }
  }
}
