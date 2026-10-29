import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { errorMessage } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <section class="auth-card card">
      <h1>Project S</h1>
      <p class="muted">{{ mode() === 'login' ? 'Sign in to your account' : 'Create an account' }}</p>

      <form (ngSubmit)="submit()" class="stack">
        @if (mode() === 'register') {
          <label>Display name <input name="displayName" [(ngModel)]="displayName" autocomplete="nickname" /></label>
        }
        <label>Email <input name="email" type="email" [(ngModel)]="email" required autocomplete="email" /></label>
        <label>
          Password
          <input name="password" type="password" [(ngModel)]="password" required minlength="8"
                 [autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'" />
        </label>
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <button type="submit" class="primary" [disabled]="busy()">
          {{ mode() === 'login' ? 'Sign in' : 'Create account' }}
        </button>
      </form>

      <button type="button" class="link" (click)="toggle()">
        {{ mode() === 'login' ? 'No account? Register' : 'Have an account? Sign in' }}
      </button>
    </section>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly mode = signal<'login' | 'register'>('login');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected email = '';
  protected password = '';
  protected displayName = '';

  protected toggle(): void {
    this.mode.update((m) => (m === 'login' ? 'register' : 'login'));
    this.error.set(null);
  }

  protected submit(): void {
    this.busy.set(true);
    this.error.set(null);
    const request = this.mode() === 'login'
      ? this.auth.login(this.email, this.password)
      : this.auth.register(this.email, this.password, this.displayName);
    request.subscribe({
      next: () => void this.router.navigateByUrl('/'),
      error: (err) => {
        this.error.set(errorMessage(err));
        this.busy.set(false);
      },
    });
  }
}
