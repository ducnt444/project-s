import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service.js';

const service = (env: Record<string, string>) =>
  new MailService(new ConfigService(env));

describe('MailService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends through the Resend API when RESEND_API_KEY is set', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{"id":"1"}', { status: 200 }));
    await service({
      RESEND_API_KEY: 're_test',
      MAIL_FROM: 'Project S <onboarding@resend.dev>',
    }).send('me@example.com', 'Hello', 'Body');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer re_test' });
    expect(JSON.parse(init?.body as string)).toEqual({
      from: 'Project S <onboarding@resend.dev>',
      to: ['me@example.com'],
      subject: 'Hello',
      text: 'Body',
    });
  });

  it('throws when Resend rejects the email', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"message":"invalid from"}', { status: 422 }),
    );
    await expect(
      service({ RESEND_API_KEY: 're_test' }).send('a@b.c', 's', 't'),
    ).rejects.toThrow('Resend API returned 422');
  });

  it('only logs when nothing is configured', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await service({}).send('a@b.c', 's', 't');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
