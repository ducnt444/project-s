import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const url = config.get<string>('SMTP_URL');
    this.transport = url ? nodemailer.createTransport(url) : null;
    this.from = config.get('MAIL_FROM', 'Project S <alerts@project-s.local>');
    if (!this.transport)
      this.logger.warn('SMTP_URL not set; emails will only be logged');
  }

  async send(to: string, subject: string, text: string) {
    if (!this.transport) {
      this.logger.log(`[mail disabled] to=${to} subject="${subject}"\n${text}`);
      return;
    }
    await this.transport.sendMail({ from: this.from, to, subject, text });
  }
}
