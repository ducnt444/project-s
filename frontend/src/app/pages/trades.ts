import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { errorMessage } from '../core/auth.interceptor';
import { ExtractedTrades, ImportResult, Trade, TradeInput } from '../core/models';

@Component({
  selector: 'app-trades',
  imports: [FormsModule, CurrencyPipe, DatePipe, DecimalPipe],
  template: `
    <h1>Trades</h1>

    <section class="card">
      <h2>Import history</h2>
      <div class="import-row">
        <label class="file-drop">
          <strong>Screenshot</strong>
          <span class="muted">PNG/JPEG/WebP from your trading app. You can review rows before saving.</span>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" (change)="onImage($event)" [disabled]="busy()" />
        </label>
        <label class="file-drop">
          <strong>Excel or CSV</strong>
          <span class="muted">
            An .xlsx or .csv file with columns for symbol, side, quantity, price and date.
            <a href="trades-template.csv" download (click)="$event.stopPropagation()">Download a template</a>
          </span>
          <input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" (change)="onSpreadsheet($event)" [disabled]="busy()" />
        </label>
        <label class="file-drop">
          <strong>JSON file</strong>
          <span class="muted">An array of trades, or <code>{{ '{' }} "trades": [...] {{ '}' }}</code>.</span>
          <input type="file" accept="application/json,.json" (change)="onJson($event)" [disabled]="busy()" />
        </label>
      </div>
      @if (busy()) { <p class="muted">Working…</p> }
      @if (message()) { <p class="success" role="status">{{ message() }}</p> }
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
    </section>

    @if (review(); as rows) {
      <section class="card">
        <h2>Review imported trades</h2>
        @if (format(); as f) {
          <p class="muted">Recognised <strong>{{ f.name }}</strong>. {{ f.details }}</p>
        }
        @for (w of warnings(); track $index) { <p class="warning">⚠ {{ w }}</p> }
        @if (rows.length === 0) {
          <p class="muted">No trades found in the {{ reviewSource() === 'image' ? 'screenshot' : 'file' }}.</p>
        } @else {
          <div class="table-scroll">
            <table class="edit-table">
              <thead><tr><th>Symbol</th><th>Side</th><th>Qty</th><th>Price</th><th>Fee</th><th>Executed at</th><th></th></tr></thead>
              <tbody>
                @for (r of rows; track $index) {
                  <tr>
                    <td><input [(ngModel)]="r.symbol" [name]="'sym' + $index" /></td>
                    <td>
                      <select [(ngModel)]="r.side" [name]="'side' + $index"><option>BUY</option><option>SELL</option></select>
                    </td>
                    <td><input type="number" [(ngModel)]="r.quantity" [name]="'qty' + $index" /></td>
                    <td><input type="number" [(ngModel)]="r.price" [name]="'px' + $index" /></td>
                    <td><input type="number" [(ngModel)]="r.fee" [name]="'fee' + $index" /></td>
                    <td>
                      <input type="datetime-local" step="1" [name]="'at' + $index"
                             [ngModel]="toLocalInput(r.executedAt)" (ngModelChange)="r.executedAt = fromLocalInput($event, r.executedAt)" />
                    </td>
                    <td><button type="button" class="link" (click)="removeRow($index)" aria-label="Remove row">✕</button></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        <div class="actions">
          <button class="primary" (click)="saveReview()" [disabled]="busy() || rows.length === 0">Save {{ rows.length }} trade(s)</button>
          <button (click)="review.set(null)">Discard</button>
        </div>
      </section>
    }

    <section class="card">
      <div class="card-header">
        <h2>History ({{ trades().length }})</h2>
        @if (trades().length > 0) {
          <button type="button" class="danger" (click)="removeAll()" [disabled]="busy()">Delete all trades</button>
        }
      </div>
      @if (trades().length === 0) {
        <p class="muted">No trades yet.</p>
      } @else {
        <div class="table-scroll">
          <table>
            <thead><tr><th>Date</th><th>Symbol</th><th>Side</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Fee</th><th>Source</th><th></th></tr></thead>
            <tbody>
              @for (t of trades(); track t.id) {
                <tr>
                  <td>{{ t.executedAt | date: 'mediumDate' }}</td>
                  <td>{{ t.symbol }}</td>
                  <td><span class="pill" [class.buy]="t.side === 'BUY'" [class.sell]="t.side === 'SELL'">{{ t.side }}</span></td>
                  <td class="num">{{ t.quantity | number: '1.0-4' }}</td>
                  <td class="num">{{ t.price | currency: t.currency }}</td>
                  <td class="num">{{ t.fee | currency: t.currency }}</td>
                  <td class="muted">{{ t.source }}</td>
                  <td><button class="link" (click)="remove(t)" aria-label="Delete trade">Delete</button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class TradesPage implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly trades = signal<Trade[]>([]);
  protected readonly review = signal<TradeInput[] | null>(null);
  protected readonly reviewSource = signal<'image' | 'excel'>('image');
  protected readonly format = signal<ExtractedTrades['format']>(null);
  protected readonly warnings = signal<string[]>([]);
  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected onImage(event: Event): void {
    const file = this.takeFile(event);
    if (!file) return;
    this.start();
    this.api.extractFromImage(file).subscribe({
      next: (res) => this.showReview(res, 'image'),
      error: (err) => this.fail(err),
    });
  }

  protected onSpreadsheet(event: Event): void {
    const file = this.takeFile(event);
    if (!file) return;
    this.start();
    this.api.extractFromSpreadsheet(file).subscribe({
      next: (res) => this.showReview(res, 'excel'),
      error: (err) => this.fail(err),
    });
  }

  protected async onJson(event: Event): Promise<void> {
    const file = this.takeFile(event);
    if (!file) return;
    this.start();
    let payload: unknown;
    try {
      payload = JSON.parse(await file.text());
    } catch {
      this.fail(null, 'That file is not valid JSON.');
      return;
    }
    this.api.importJson(payload).subscribe({
      next: (res) => this.done(this.summarise('Imported', res)),
      error: (err) => this.fail(err),
    });
  }

  protected removeRow(index: number): void {
    this.review.update((rows) => rows?.filter((_, i) => i !== index) ?? null);
  }

  protected saveReview(): void {
    const rows = this.review();
    if (!rows) return;
    this.start();
    this.api.saveTrades(rows, this.reviewSource()).subscribe({
      next: (res) => {
        this.review.set(null);
        this.warnings.set([]);
        this.done(this.summarise('Saved', res));
      },
      error: (err) => this.fail(err),
    });
  }

  protected remove(trade: Trade): void {
    if (!confirm(`Delete ${trade.side} ${trade.symbol}?`)) return;
    this.api.deleteTrade(trade.id).subscribe({
      next: () => this.trades.update((list) => list.filter((t) => t.id !== trade.id)),
      error: (err) => this.fail(err),
    });
  }

  protected removeAll(): void {
    const count = this.trades().length;
    const ok = confirm(
      `Delete all ${count} trade(s)? Your dashboard will be empty until you import again. ` +
        'This cannot be undone. Alerts are kept.',
    );
    if (!ok) return;
    this.start();
    this.api.deleteAllTrades().subscribe({
      next: (res) => this.done(`Deleted ${res.deleted} trade(s).`),
      error: (err) => this.fail(err),
    });
  }

  private showReview(res: ExtractedTrades, source: 'image' | 'excel'): void {
    this.review.set(res.trades.map((t) => ({ ...t, fee: t.fee ?? 0 })));
    this.warnings.set(res.warnings);
    this.reviewSource.set(source);
    this.format.set(res.format ?? null);
    this.busy.set(false);
  }

  /** ISO instant -> "YYYY-MM-DDTHH:mm:ss" in the browser's time zone, for datetime-local inputs. */
  protected toLocalInput(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 19);
  }

  protected fromLocalInput(value: string, previous: string): string {
    const d = new Date(value); // parsed as local time
    return isNaN(d.getTime()) ? previous : d.toISOString();
  }

  private summarise(verb: string, res: ImportResult): string {
    const skipped = res.duplicates
      ? ` ${res.duplicates} already imported (same order ID) were skipped.`
      : '';
    return `${verb} ${res.imported} trade(s).${skipped}`;
  }

  private load(): void {
    this.api.trades().subscribe((list) => this.trades.set(list));
  }

  private takeFile(event: Event): File | undefined {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    return file;
  }

  private start(): void {
    this.busy.set(true);
    this.message.set(null);
    this.error.set(null);
  }

  private done(message: string): void {
    this.busy.set(false);
    this.message.set(message);
    this.load();
  }

  private fail(err: unknown, message?: string): void {
    this.busy.set(false);
    this.error.set(message ?? errorMessage(err));
  }
}
