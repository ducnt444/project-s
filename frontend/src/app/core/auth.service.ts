import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { AuthResponse, UserProfile } from './models';

const STORAGE_KEY = 'project-s.auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly session = signal<AuthResponse | null>(this.restore());

  readonly user = computed<UserProfile | null>(() => this.session()?.user ?? null);
  readonly isLoggedIn = computed(() => this.session() !== null);

  get token(): string | null {
    return this.session()?.accessToken ?? null;
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/login', { email, password }).pipe(tap((r) => this.store(r)));
  }

  register(email: string, password: string, displayName?: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>('/api/auth/register', { email, password, displayName: displayName || undefined })
      .pipe(tap((r) => this.store(r)));
  }

  logout(): void {
    this.store(null);
    void this.router.navigateByUrl('/login');
  }

  private store(session: AuthResponse | null): void {
    this.session.set(session);
    try {
      if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage unavailable (private mode): the session lasts for this tab only.
    }
  }

  private restore(): AuthResponse | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AuthResponse) : null;
    } catch {
      return null;
    }
  }
}
