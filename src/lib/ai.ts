// Client for the JimBuddy AI proxy (see /proxy). The phone never holds an OpenAI key.

export interface PlateItem {
  name: string;
  grams: number;
  household: string | null;
  confidence: number;
}
export interface PlateResult {
  items: PlateItem[];
  oil_level: 'low' | 'normal' | 'high' | null;
  question: string | null;
}
export interface LabelResult {
  name: string;
  serving_grams: number | null;
  per_100g: { kcal: number; protein: number; carbs: number; fat: number; fiber: number | null };
}

export class ProxyError extends Error {
  constructor(public code: 'not_configured' | 'offline' | 'timeout' | 'bad_token' | 'daily_cap' | 'server', message: string) {
    super(message);
  }
}

async function call<T>(base: string | null, token: string | null, path: string, body: object): Promise<{ result: T; remaining?: number }> {
  if (!base || !token) throw new ProxyError('not_configured', 'Add your proxy URL and invite token in Profile → Settings.');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  let r: Response;
  try {
    r = await fetch(`${base.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-invite-token': token },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    const aborted = (e as Error)?.name === 'AbortError';
    throw new ProxyError(aborted ? 'timeout' : 'offline', aborted ? 'The scan took longer than 20 s.' : 'No connection to the scan service.');
  } finally {
    clearTimeout(timer);
  }
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) throw new ProxyError('bad_token', 'Invite token not accepted.');
  if (r.status === 429) throw new ProxyError('daily_cap', 'Daily scan limit reached. Use search or quick add.');
  if (!r.ok || !data.result) throw new ProxyError('server', `Scan service error (${data.error ?? r.status}).`);
  return data;
}

const localTime = () => new Date().toTimeString().slice(0, 5);

export const scanPlate = (base: string | null, token: string | null, p: { image: string; hint?: string; slot: string; place?: string }) =>
  call<PlateResult>(base, token, '/v1/scan', { ...p, local_time: localTime() });

export const describePlate = (base: string | null, token: string | null, p: { text: string; slot: string }) =>
  call<PlateResult>(base, token, '/v1/describe', { ...p, local_time: localTime() });

export const scanLabel = (base: string | null, token: string | null, p: { image: string }) =>
  call<LabelResult>(base, token, '/v1/label', p);

export async function testProxy(base: string): Promise<boolean> {
  try {
    const r = await fetch(`${base.replace(/\/$/, '')}/v1/health`);
    return r.ok;
  } catch {
    return false;
  }
}
