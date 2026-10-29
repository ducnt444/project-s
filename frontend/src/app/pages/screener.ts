import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { errorMessage } from '../core/auth.interceptor';
import { ScreenerResponse } from '../core/models';

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

@Component({
  selector: 'app-screener',
  imports: [FormsModule, CurrencyPipe, DecimalPipe],
  template: `
    <h1>Screener</h1>
    <section class="card">
      <form (ngSubmit)="run()" class="stack">
        <label for="prompt">Describe the stocks you are looking for</label>
        <textarea id="prompt" name="prompt" rows="2" [(ngModel)]="prompt"
                  placeholder="e.g. Large-cap healthcare stocks paying over 3% dividend with beta under 1"></textarea>
        <div class="actions">
          <button class="primary" type="submit" [disabled]="busy() || prompt.trim().length < 3">Search</button>
          @for (ex of examples; track ex) {
            <button type="button" class="chip" (click)="prompt = ex; run()">{{ ex }}</button>
          }
        </div>
      </form>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
    </section>

    @if (busy()) { <p class="muted">Searching…</p> }

    @if (result(); as r) {
      <section class="card">
        <p><strong>Interpreted as:</strong> {{ r.filter.explanation }}</p>
        <div class="chips">
          @for (c of criteria(); track c) { <span class="pill">{{ c }}</span> }
        </div>
        @if (r.results.length === 0) {
          <p class="muted">No stocks matched.</p>
        } @else {
          <div class="table-scroll">
            <table>
              <thead>
                <tr><th>Symbol</th><th>Name</th><th>Sector</th><th class="num">Price</th><th class="num">Market cap</th><th class="num">Beta</th><th class="num">Div. yield</th></tr>
              </thead>
              <tbody>
                @for (s of r.results; track s.symbol) {
                  <tr>
                    <td><strong>{{ s.symbol }}</strong></td>
                    <td>{{ s.name }}</td>
                    <td class="muted">{{ s.sector ?? '–' }}</td>
                    <td class="num">{{ s.price === null ? '–' : (s.price | currency) }}</td>
                    <td class="num">{{ s.marketCap === null ? '–' : fmt(s.marketCap) }}</td>
                    <td class="num">{{ s.beta === null ? '–' : (s.beta | number: '1.2-2') }}</td>
                    <td class="num">{{ s.dividendYield === null ? '–' : (s.dividendYield | number: '1.1-2') + '%' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    }
  `,
})
export class ScreenerPage {
  private readonly api = inject(ApiService);

  protected prompt = '';
  protected readonly examples = [
    'Large-cap tech stocks under $300',
    'Dividend stocks yielding more than 3%',
    'High-beta NASDAQ stocks',
  ];
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly result = signal<ScreenerResponse | null>(null);
  protected readonly criteria = computed(() => {
    const f = this.result()?.filter ?? {};
    return Object.entries(f)
      .filter(([k, v]) => v !== null && k !== 'explanation')
      .map(([k, v]) => `${k}: ${typeof v === 'number' && Math.abs(v) >= 1e5 ? compact.format(v) : v}`);
  });

  protected fmt(n: number): string {
    return compact.format(n);
  }

  protected run(): void {
    this.busy.set(true);
    this.error.set(null);
    this.api.screen(this.prompt.trim()).subscribe({
      next: (r) => {
        this.result.set(r);
        this.busy.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.busy.set(false);
      },
    });
  }
}
