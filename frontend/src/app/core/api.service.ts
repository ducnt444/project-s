import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  Alert,
  AlertCondition,
  AnalyticsSummary,
  ExtractedTrades,
  ImportResult,
  ScreenerResponse,
  Trade,
  TradeInput,
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  trades() {
    return this.http.get<Trade[]>('/api/trades');
  }

  saveTrades(trades: TradeInput[], source: 'manual' | 'image' | 'excel') {
    return this.http.post<ImportResult>('/api/trades', { trades, source });
  }

  importJson(payload: unknown) {
    return this.http.post<ImportResult>('/api/trades/import/json', payload);
  }

  extractFromImage(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ExtractedTrades>('/api/trades/import/image', form);
  }

  extractFromSpreadsheet(file: File) {
    const form = new FormData();
    form.append('file', file);
    // Used for dates without a zone, unless the file's format implies one.
    form.append('timeZone', Intl.DateTimeFormat().resolvedOptions().timeZone);
    return this.http.post<ExtractedTrades>('/api/trades/import/spreadsheet', form);
  }

  deleteTrade(id: string) {
    return this.http.delete<void>(`/api/trades/${id}`);
  }

  summary() {
    return this.http.get<AnalyticsSummary>('/api/analytics/summary');
  }

  screen(prompt: string) {
    return this.http.post<ScreenerResponse>('/api/screener/query', { prompt });
  }

  alerts() {
    return this.http.get<Alert[]>('/api/alerts');
  }

  createAlert(alert: { symbol: string; condition: AlertCondition; threshold: number; cooldownMinutes: number; oneShot: boolean }) {
    return this.http.post<Alert>('/api/alerts', alert);
  }

  updateAlert(id: string, patch: Partial<Pick<Alert, 'active' | 'threshold' | 'condition' | 'cooldownMinutes' | 'oneShot'>>) {
    return this.http.patch<Alert>(`/api/alerts/${id}`, patch);
  }

  deleteAlert(id: string) {
    return this.http.delete<void>(`/api/alerts/${id}`);
  }
}
