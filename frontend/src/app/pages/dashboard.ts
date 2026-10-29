import { CurrencyPipe, DecimalPipe, PercentPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { ApiService } from '../core/api.service';
import { PnlBarChart } from '../shared/pnl-bar-chart';

@Component({
  selector: 'app-dashboard',
  imports: [PnlBarChart, CurrencyPipe, DecimalPipe, PercentPipe, RouterLink],
  template: `
    <h1>Dashboard</h1>
    @if (summary(); as s) {
      @if (s.totals.tradeCount === 0) {
        <div class="card empty">
          <p>No trades yet.</p>
          <a routerLink="/trades" class="button primary">Import your history</a>
        </div>
      } @else {
        <div class="tiles">
          <div class="card tile">
            <span class="tile-label">Realized P/L</span>
            <span class="tile-value" [class.gain]="s.totals.realizedPnl >= 0" [class.loss]="s.totals.realizedPnl < 0">
              {{ s.totals.realizedPnl >= 0 ? '▲' : '▼' }} {{ s.totals.realizedPnl | currency }}
            </span>
          </div>
          <div class="card tile">
            <span class="tile-label">Win rate</span>
            <span class="tile-value">{{ s.totals.winRate === null ? '–' : (s.totals.winRate | percent: '1.0-0') }}</span>
          </div>
          <div class="card tile">
            <span class="tile-label">Closing trades</span>
            <span class="tile-value">{{ s.totals.closedTrades }}</span>
          </div>
          <div class="card tile">
            <span class="tile-label">Open positions</span>
            <span class="tile-value">{{ s.openPositions.length }}</span>
          </div>
        </div>

        @if (s.unmatched.length) {
          <p class="warning" role="note">
            ⚠ {{ s.unmatched.length }} sell(s) had no matching buy, so their P/L is excluded. Import older history to fix.
          </p>
        }

        <div class="grid-2">
          <section class="card">
            <h2>Realized P/L by month</h2>
            <app-pnl-bar-chart [rows]="s.byMonth" label="Realized profit and loss by month" />
          </section>
          <section class="card">
            <h2>Realized P/L by symbol</h2>
            <app-pnl-bar-chart [rows]="s.bySymbol" [horizontal]="true" label="Realized profit and loss by symbol" />
          </section>
        </div>

        <details class="card">
          <summary>Data table</summary>
          <table>
            <thead><tr><th>Symbol</th><th class="num">Closing trades</th><th class="num">Cost basis</th><th class="num">Proceeds</th><th class="num">P/L</th></tr></thead>
            <tbody>
              @for (r of s.bySymbol; track r.key) {
                <tr>
                  <td>{{ r.key }}</td><td class="num">{{ r.trades }}</td>
                  <td class="num">{{ r.costBasis | currency }}</td><td class="num">{{ r.proceeds | currency }}</td>
                  <td class="num">{{ r.pnl | currency }}</td>
                </tr>
              }
            </tbody>
          </table>
        </details>

        @if (s.openPositions.length) {
          <section class="card">
            <h2>Open positions</h2>
            <table>
              <thead><tr><th>Symbol</th><th class="num">Quantity</th><th class="num">Avg cost</th><th class="num">Cost basis</th></tr></thead>
              <tbody>
                @for (p of s.openPositions; track p.symbol) {
                  <tr>
                    <td>{{ p.symbol }}</td><td class="num">{{ p.quantity | number: '1.0-4' }}</td>
                    <td class="num">{{ p.averageCost | currency }}</td><td class="num">{{ p.costBasis | currency }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </section>
        }
      }
    } @else {
      <p class="muted">Loading…</p>
    }
  `,
})
export class DashboardPage {
  protected readonly summary = toSignal(inject(ApiService).summary().pipe(catchError(() => of(undefined))));
}
