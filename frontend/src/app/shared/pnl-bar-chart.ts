import { Component, ElementRef, effect, input, OnDestroy, viewChild } from '@angular/core';
import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip } from 'chart.js';
import { PnlRow } from '../core/models';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

/** Formats an amount in `currency`, or as a plain number when it is null (mixed currencies). */
export function formatMoney(value: number, currency: string | null, compact = false): string {
  // en-US to match the app's Angular pipes, so all numbers use the same separators.
  return new Intl.NumberFormat('en-US', {
    ...(currency ? { style: 'currency', currency } : {}),
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : currency ? undefined : 2,
  }).format(value);
}

/** Reads a CSS custom property so the chart follows the light/dark theme tokens. */
function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Bar chart of realized P/L. Gains and losses use the diverging blue/red pair
 * (colorblind-safe, unlike green/red); bars grow from a zero baseline.
 */
@Component({
  selector: 'app-pnl-bar-chart',
  template: `<div class="chart-box"><canvas #canvas [attr.aria-label]="label()" role="img"></canvas></div>`,
})
export class PnlBarChart implements OnDestroy {
  readonly rows = input.required<PnlRow[]>();
  readonly label = input('Realized profit and loss');
  readonly horizontal = input(false);
  readonly currency = input<string | null>('USD');

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart?: Chart<'bar'>;
  private readonly media = matchMedia('(prefers-color-scheme: dark)');
  private readonly rerender = () => this.render(this.rows(), this.currency());

  constructor() {
    effect(() => this.render(this.rows(), this.currency()));
    this.media.addEventListener('change', this.rerender);
  }

  ngOnDestroy(): void {
    this.media.removeEventListener('change', this.rerender);
    this.chart?.destroy();
  }

  private render(rows: PnlRow[], currency: string | null): void {
    this.chart?.destroy();
    const gain = token('--gain');
    const loss = token('--loss');
    const muted = token('--text-muted');
    const grid = token('--grid');
    const valueAxis = { grid: { color: grid }, border: { display: false }, ticks: { color: muted, callback: (v: string | number) => formatMoney(Number(v), currency, true) } };
    const categoryAxis = { grid: { display: false }, border: { color: grid }, ticks: { color: muted } };

    this.chart = new Chart(this.canvas().nativeElement, {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.key),
        datasets: [
          {
            data: rows.map((r) => r.pnl),
            backgroundColor: rows.map((r) => (r.pnl >= 0 ? gain : loss)),
            borderRadius: 4,
            borderSkipped: 'start',
            maxBarThickness: 28,
          },
        ],
      },
      options: {
        indexAxis: this.horizontal() ? 'y' : 'x',
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'nearest', intersect: false, axis: this.horizontal() ? 'y' : 'x' },
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const row = rows[ctx.dataIndex];
                return `${formatMoney(row.pnl, currency)} · ${row.trades} closing trade${row.trades === 1 ? '' : 's'}`;
              },
            },
          },
        },
        scales: this.horizontal() ? { x: valueAxis, y: categoryAxis } : { x: categoryAxis, y: valueAxis },
      },
    });
  }
}
