# JimBuddy AI proxy

A Cloudflare Worker between the app and OpenAI. It keeps the API key off the phones, checks invite tokens,
caps calls per person per day (default 20), and asks the model for **foods and grams only**. The app turns those
into calories from its food database.

## Deploy (about 10 minutes)

```bash
cd proxy
npm install
npx wrangler login
npx wrangler kv namespace create USAGE        # paste the id into wrangler.toml
npx wrangler secret put OPENAI_API_KEY         # an API key from platform.openai.com (ChatGPT Plus does not cover API use)
npx wrangler secret put INVITE_TOKENS          # e.g. shravan-7f3k,ravi-9q2m  (one per friend)
npx wrangler deploy                            # prints https://jimbuddy-proxy.<you>.workers.dev
```

In the app: Profile → Settings → paste the URL and your invite token → "Test connection".

## Endpoints

```text
POST /v1/scan      { image(base64 jpeg), hint, slot, local_time, place } -> { result: { items[], oil_level, question }, remaining }
POST /v1/describe  { text, slot, local_time }                           -> same
POST /v1/label     { image }                                            -> { result: { name, serving_grams, per_100g } }
GET  /v1/health
Header: x-invite-token
```

Change the model with `MODEL` in `wrangler.toml` (any vision-capable model). Rerun the eval after every change.

## Accuracy eval

See `eval/run-eval.mjs`: ~30 weighed meals → item recall and gram error. Keep it, and rerun it whenever the model or prompt changes.
