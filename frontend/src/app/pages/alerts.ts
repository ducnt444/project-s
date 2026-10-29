import { DatePipe, KeyValuePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { errorMessage } from '../core/auth.interceptor';
import { Alert, ALERT_CONDITIONS, AlertCondition } from '../core/models';

@Component({
  selector: 'app-alerts',
  imports: [FormsModule, DatePipe, KeyValuePipe],
  template: `
    <h1>Alerts</h1>
    <p class="muted">You get an email when a condition is met. Prices are checked every few seconds while the server runs.</p>

    <section class="card">
      <h2>New alert</h2>
      <form class="alert-form" (ngSubmit)="create()">
        <label>Symbol <input name="symbol" [(ngModel)]="symbol" required placeholder="AAPL" /></label>
        <label>
          Condition
          <select name="condition" [(ngModel)]="condition">
            @for (c of conditions | keyvalue; track c.key) { <option [value]="c.key">{{ c.value }}</option> }
          </select>
        </label>
        <label>Threshold <input name="threshold" type="number" step="any" [(ngModel)]="threshold" required /></label>
        <label>Cooldown (min) <input name="cooldown" type="number" min="1" [(ngModel)]="cooldownMinutes" /></label>
        <label class="inline"><input name="oneShot" type="checkbox" [(ngModel)]="oneShot" /> Only once</label>
        <button class="primary" type="submit" [disabled]="!symbol || threshold === null">Add</button>
      </form>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
    </section>

    <section class="card">
      <h2>Your alerts</h2>
      @if (alerts().length === 0) {
        <p class="muted">No alerts yet.</p>
      } @else {
        <div class="table-scroll">
          <table>
            <thead><tr><th>Symbol</th><th>Condition</th><th>Status</th><th>Last triggered</th><th></th></tr></thead>
            <tbody>
              @for (a of alerts(); track a.id) {
                <tr>
                  <td><strong>{{ a.symbol }}</strong></td>
                  <td>{{ conditions[a.condition] }} {{ a.threshold }}</td>
                  <td>
                    <span class="pill" [class.on]="a.active">{{ a.active ? '● Active' : '○ Paused' }}</span>
                  </td>
                  <td class="muted">{{ a.lastTriggeredAt ? (a.lastTriggeredAt | date: 'short') : 'Never' }}</td>
                  <td class="actions">
                    <button class="link" (click)="toggle(a)">{{ a.active ? 'Pause' : 'Resume' }}</button>
                    <button class="link" (click)="remove(a)">Delete</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class AlertsPage implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly conditions = ALERT_CONDITIONS;
  protected readonly alerts = signal<Alert[]>([]);
  protected readonly error = signal<string | null>(null);
  protected symbol = '';
  protected condition: AlertCondition = 'PRICE_ABOVE';
  protected threshold: number | null = null;
  protected cooldownMinutes = 60;
  protected oneShot = false;

  ngOnInit(): void {
    this.api.alerts().subscribe((list) => this.alerts.set(list));
  }

  protected create(): void {
    if (this.threshold === null) return;
    this.error.set(null);
    this.api
      .createAlert({
        symbol: this.symbol.trim().toUpperCase(),
        condition: this.condition,
        threshold: this.threshold,
        cooldownMinutes: this.cooldownMinutes,
        oneShot: this.oneShot,
      })
      .subscribe({
        next: (alert) => {
          this.alerts.update((list) => [alert, ...list]);
          this.symbol = '';
          this.threshold = null;
        },
        error: (err) => this.error.set(errorMessage(err)),
      });
  }

  protected toggle(alert: Alert): void {
    this.api.updateAlert(alert.id, { active: !alert.active }).subscribe({
      next: (updated) => this.alerts.update((list) => list.map((a) => (a.id === updated.id ? updated : a))),
      error: (err) => this.error.set(errorMessage(err)),
    });
  }

  protected remove(alert: Alert): void {
    this.api.deleteAlert(alert.id).subscribe({
      next: () => this.alerts.update((list) => list.filter((a) => a.id !== alert.id)),
      error: (err) => this.error.set(errorMessage(err)),
    });
  }
}
