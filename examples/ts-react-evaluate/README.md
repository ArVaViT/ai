# Evaluate (ts-react-evaluate)

A small TanStack Start app that shows the `evaluator()` activity. You paste a
support ticket. Jev answers three typed questions: which queue, how urgent, and
whether the customer asks for a refund.

The same `decide()` call runs for every provider. Only the adapter changes.

## Tech stack

- TanStack Start (full-stack React)
- `@tanstack/ai`: `evaluator()`, `choice()`, `score()`, `boolean()`
- `@tanstack/ai-typesafe`: `typesafeEvaluator('jev-latest')`
- `@tanstack/ai-openrouter`: `openRouterEvaluator('~typesafe/jev-latest')`
- `@tanstack/ai-vercel-gateway`: `vercelGatewayEvaluator('typesafe-ai/jev')`
- `@tanstack/ai-cloudflare`: `cloudflareEvaluator('typesafe/jev')`

## Getting started

```bash
cd examples/ts-react-evaluate
pnpm install
cp .env.example .env
# Add the key for the provider you pick
pnpm dev
```

Open http://localhost:3000. You only need a key for the provider you select.

- TypeSafe: set `TYPESAFE_API_KEY`. Get a key at https://typesafe.ai
- OpenRouter: set `OPENROUTER_API_KEY`. Get a key at https://openrouter.ai/keys
- Vercel AI Gateway: set `AI_GATEWAY_API_KEY`
- Cloudflare: set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`

## What the screen shows

The page has a textarea with a sample support ticket, a provider dropdown, and
a Submit button.

After a run, the panel shows:

- `result.queue.value` and its probability
- `result.urgency.value` and the raw score
- `result.refund.value` and its probability
- `result.meta.model`

API keys stay on the server. Each adapter reads its key from the environment
inside the server function.

## Files worth reading

| File                               | What is in it                                   |
| ---------------------------------- | ----------------------------------------------- |
| `src/lib/server-functions.ts`      | The `decide()` calls and adapter selection      |
| `src/lib/models.ts`                | Provider labels, model slugs, and env var names |
| `src/components/EvaluatePanel.tsx` | The ticket form and the result panel            |

## Learn more

- [TypeSafe adapter README](../../packages/ai-typesafe/README.md)
- [OpenRouter adapter](../../docs/adapters/openrouter.md)
- [Vercel AI Gateway adapter](../../docs/adapters/vercel-gateway.md)
- [Cloudflare adapter](../../docs/adapters/cloudflare.md)
