// JimBuddy AI proxy (Cloudflare Worker).
// Holds the OpenAI key, checks each friend's invite token, caps calls per person per day,
// and asks the model for foods + grams only. Nutrition is computed on the phone from the food database.
// Photos are processed in memory and never stored here.

export interface Env {
  OPENAI_API_KEY: string;
  INVITE_TOKENS: string; // comma-separated
  MODEL?: string; // default gpt-5.6-luna (vision-capable)
  DAILY_CAP?: string; // default 20
  USAGE: KVNamespace;
}

// Minimal KV typing so this file type-checks without @cloudflare/workers-types.
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

const ITEMS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'oil_level', 'question'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'grams', 'household', 'confidence'],
        properties: {
          name: { type: 'string', description: 'Common Indian or English dish/food name, singular, no brand' },
          grams: { type: 'number', description: 'Estimated edible weight in grams' },
          household: { type: ['string', 'null'], description: 'e.g. "2 rotis", "1 katori", "1 plate"' },
          confidence: { type: 'number', description: '0 to 1' },
        },
      },
    },
    oil_level: { type: ['string', 'null'], enum: ['low', 'normal', 'high', null] },
    question: { type: ['string', 'null'], description: 'One clarifying question if two dishes look alike, else null' },
  },
} as const;

const LABEL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'serving_grams', 'per_100g'],
  properties: {
    name: { type: 'string' },
    serving_grams: { type: ['number', 'null'] },
    per_100g: {
      type: 'object',
      additionalProperties: false,
      required: ['kcal', 'protein', 'carbs', 'fat', 'fiber'],
      properties: {
        kcal: { type: 'number' },
        protein: { type: 'number' },
        carbs: { type: 'number' },
        fat: { type: 'number' },
        fiber: { type: ['number', 'null'] },
      },
    },
  },
} as const;

const ITEMS_PROMPT = `You identify foods on a plate for a calorie tracker used in India.
Rules:
- List each separable item (each curry, rice, roti, side, drink) as its own entry.
- Estimate the edible weight in grams. Never estimate calories.
- Use common Indian dish names where they apply (dal, sambar, chapati, curd rice, chicken biryani).
- If you cannot tell what something is, name it "unknown" with low confidence instead of guessing.
- Visible oil or ghee: set oil_level to low, normal or high (null if not applicable).
- Ask at most one clarifying question, only when two dishes look alike (e.g. paneer vs chicken curry).
Use the context (meal, time, place, user hint) to judge typical portions.`;

const LABEL_PROMPT = `Read the nutrition label in the photo. Return values per 100 g (convert from per-serving if needed).
Return the product's short name and the serving size in grams if printed. Do not guess missing numbers: use null for fiber if absent.`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type,x-invite-token', 'access-control-allow-methods': 'POST,GET' } });
    }
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname === '/v1/health') return json({ ok: true });
    if (req.method !== 'POST') return json({ error: 'not_found' }, 404);

    const token = req.headers.get('x-invite-token') ?? '';
    const allowed = (env.INVITE_TOKENS ?? '').split(',').map((t) => t.trim()).filter(Boolean);
    if (!allowed.includes(token)) return json({ error: 'bad_token' }, 401);

    const cap = Number(env.DAILY_CAP ?? 20);
    const key = `${token}:${new Date().toISOString().slice(0, 10)}`;
    const used = Number((await env.USAGE.get(key)) ?? 0);
    if (used >= cap) return json({ error: 'daily_cap', cap }, 429);

    let body: { image?: string; text?: string; hint?: string; slot?: string; local_time?: string; place?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'bad_json' }, 400);
    }

    const label = url.pathname === '/v1/label';
    if (!['/v1/scan', '/v1/describe', '/v1/label'].includes(url.pathname)) return json({ error: 'not_found' }, 404);
    if ((url.pathname !== '/v1/describe' && !body.image) || (url.pathname === '/v1/describe' && !body.text)) {
      return json({ error: 'missing_input' }, 400);
    }
    if (body.image && body.image.length > 2_500_000) return json({ error: 'image_too_large' }, 413);

    const context = [
      body.slot && `Meal: ${body.slot}`,
      body.local_time && `Local time: ${body.local_time}`,
      body.place && `Place: ${body.place}`,
      body.hint && `User hint: ${body.hint}`,
      body.text && `Meal description: ${body.text}`,
    ].filter(Boolean).join('\n');

    const content: unknown[] = [{ type: 'input_text', text: context || 'No extra context.' }];
    if (body.image) content.push({ type: 'input_image', image_url: `data:image/jpeg;base64,${body.image}`, detail: 'auto' });

    const started = Date.now();
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: env.MODEL ?? 'gpt-5.6-luna',
        input: [
          { role: 'system', content: label ? LABEL_PROMPT : ITEMS_PROMPT },
          { role: 'user', content },
        ],
        text: { format: { type: 'json_schema', name: label ? 'label' : 'plate', schema: label ? LABEL_SCHEMA : ITEMS_SCHEMA, strict: true } },
      }),
    });
    if (!r.ok) return json({ error: 'model_error', status: r.status, detail: (await r.text()).slice(0, 300) }, 502);

    const data = (await r.json()) as { output?: { content?: { type: string; text?: string }[] }[]; usage?: unknown };
    const text = data.output?.flatMap((o) => o.content ?? []).find((c) => c.type === 'output_text')?.text;
    if (!text) return json({ error: 'empty_output' }, 502);

    await env.USAGE.put(key, String(used + 1), { expirationTtl: 60 * 60 * 36 });
    console.log(JSON.stringify({ path: url.pathname, ms: Date.now() - started, model: env.MODEL ?? 'gpt-5.6-luna', usage: data.usage }));
    return json({ result: JSON.parse(text), remaining: cap - used - 1 });
  },
};
