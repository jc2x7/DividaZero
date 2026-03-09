import { Platform } from 'react-native';
import { getSetting, setSetting } from '../database/database';

// ============================================================
// CONFIGURAÇÃO — substitua pela URL real do seu VPS
// ============================================================
const ENDPOINT = 'https://SEU_DOMINIO/analytics/collect.php';

// ============================================================
// TIPOS
// ============================================================
type EventType = 'app_open' | 'screen_view';

interface AnalyticsEvent {
  type: EventType;
  screen: string | null;
  ts: number; // Unix timestamp (segundos)
}

// ============================================================
// ESTADO DO MÓDULO (singleton)
// ============================================================
let deviceId: string | null = null;
let sessionId: string | null = null;
let eventQueue: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;

// ============================================================
// HELPERS
// ============================================================
function genUUID(): string {
  // crypto.randomUUID() disponível no Hermes desde RN 0.73+
  return crypto.randomUUID();
}

async function sha256(input: string): Promise<string> {
  // Web Crypto API disponível no Hermes (RN 0.74+) e no browser
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================

/**
 * Inicializa o serviço de analytics.
 * Deve ser chamado 1x no _layout.tsx raiz, após getDatabase().
 * É seguro chamar múltiplas vezes (idempotente).
 */
export async function initAnalytics(): Promise<void> {
  // Não rastrear na versão web (apenas iOS e Android)
  if (Platform.OS === 'web') return;
  if (initialized) return;

  try {
    let rawId = await getSetting('analytics_device_id');
    if (!rawId) {
      rawId = genUUID();
      await setSetting('analytics_device_id', rawId);
    }
    // Apenas o hash SHA-256 é transmitido — o UUID bruto nunca sai do device
    deviceId = await sha256(rawId);
    sessionId = genUUID();
    initialized = true;
  } catch (e) {
    // Analytics nunca deve travar o app
    console.warn('[Analytics] init failed:', e);
  }
}

// ============================================================
// CONTROLE DE SESSÃO
// ============================================================

/**
 * Cria um novo session_id.
 * Chamar quando o app volta ao foreground (AppState → 'active').
 */
export function refreshSession(): void {
  if (Platform.OS === 'web') return;
  sessionId = genUUID();
}

// ============================================================
// RASTREAMENTO DE EVENTOS
// ============================================================

/**
 * Enfileira um evento para envio ao servidor.
 * O flush ocorre automaticamente após 3s de inatividade.
 *
 * @param type  'app_open' ou 'screen_view'
 * @param screen  Pathname da tela (ex: '/simulator'). null para app_open.
 */
export function trackEvent(type: EventType, screen: string | null = null): void {
  if (!initialized || !deviceId || !sessionId) return;

  eventQueue.push({ type, screen, ts: Math.floor(Date.now() / 1000) });

  // Debounce: agrupa eventos rápidos (ex: transições de tela) em 1 único request
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushEvents, 3000);
}

// ============================================================
// FLUSH IMEDIATO
// ============================================================

/**
 * Força o envio imediato da fila de eventos.
 * Chamar quando o app vai para background (AppState → 'background'/'inactive').
 */
export function flushNow(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  flushEvents(); // fire-and-forget intencional
}

// ============================================================
// ENVIO AO SERVIDOR (interno)
// ============================================================
async function flushEvents(): Promise<void> {
  if (!eventQueue.length || !deviceId || !sessionId) return;

  const batch = [...eventQueue];
  eventQueue = [];
  flushTimer = null;

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        session_id: sessionId,
        events: batch,
      }),
      signal: AbortSignal.timeout(10_000), // disponível em RN 0.73+
    });

    if (!response.ok) {
      // Erro do servidor → re-enfileira para próxima tentativa
      eventQueue = [...batch, ...eventQueue];
    }
  } catch {
    // Sem internet → re-enfileira silenciosamente
    eventQueue = [...batch, ...eventQueue];
  }
}
