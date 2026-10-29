import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token;
  const request = token && req.url.startsWith('/api/')
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && token) auth.logout();
      return throwError(() => err);
    }),
  );
};

/** Extracts a readable message from an API error response. */
export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const msg = err.error?.message;
    if (Array.isArray(msg)) return msg.join('; ');
    if (typeof msg === 'string') return msg;
    return err.statusText || 'Request failed';
  }
  return 'Something went wrong';
}
