---
name: add-example-tutorial
description: "Use when adding a public teaching example, a docs tutorial, or wiring an example onto tanstack.com (Examples tab or a live sandbox on a docs page). Don't use for an internal Nx playground under examples/<name>/ (that is new-react-playground), for a package API change with no walkthrough, or for a docs-only copy edit."
---

# Add Example Tutorial

Ship a public teaching example the way Basic Chat shipped: a slim Start app under `examples/react/<slug>/`, a Tutorial tab walkthrough, nav, tests, and a tanstack.com sibling PR only when the live sandbox or Examples tab needs a new allowlist row.

Canonical reference: `examples/react/basic-chat` and `docs/tutorials/basic-chat.md`. Copy that end-state, not the Nx generator output.

Load `docs`, `simple-english`, and `i-have-adhd` before writing tutorial pages. Load `pr-description` before `gh pr create` and after an agent push on an open PR.

## End state

- App at `examples/react/<slug>/` (not `examples/<slug>/`, not `examples/ts-*`).
- `pnpm-workspace.yaml` includes `examples/react/*`.
- Tutorial at `docs/tutorials/<slug>.md` on `"tab": "tutorial"`.
- Examples tab child `framework/react/examples/<slug>` in `docs/config.json`.
- Overview / Quick Start (and any recipe) point at the tutorial.
- GitHub link at the bottom: `https://github.com/TanStack/ai/tree/main/examples/react/<slug>`.
- Live sandbox comment on the tutorial page.
- AI PR + tanstack.com PR when a new slug must be registered. Merge AI first.

## 1. Shape the app

1. Pick a kebab-case `slug` (example: `basic-chat`).
2. From the repo root: `pnpm nx g @tanstack/workspace-plugin:react-app <slug>`.
3. Move `examples/<slug>` to `examples/react/<slug>`. Delete the old folder.
4. Slim. One adapter. Inline the model id in `createOpenRouterText('openai/gpt-5.5', apiKey)` (or the adapter this tutorial teaches). No `chat-model.ts`. No `handle-chat-post.ts`. The POST handler lives in `src/routes/api.chat.ts`.
5. Keep `workspace:*` for `@tanstack/ai*` in the example `package.json`. Do not add `@tanstack/ai-client`. Framework packages re-export the client and `/byok`.
6. Port `3100`. Ignore route tests: `tanstackStart({ router: { routeFileIgnorePattern: '\\.test\\.ts$' } })`.

Do not commit the Nx kitchen-sink (every adapter, PKCE, model picker, thinking UI).

## 2. File layout (client then server)

Match Basic Chat:

| File | Role |
|---|---|
| `src/lib/byok.ts` | `defineByok` + `memoryStorage()` + provider list |
| `src/components/open-router-key-form.tsx` (or a name for this tutorial) | Export the key form. Do not inline it in the route. |
| `src/routes/index.tsx` | Import the form. `useChat({ connection: fetchServerSentEvents('/api/chat'), byok })`. No `forwardedProps` unless this example truly needs extra body fields. |
| `src/routes/api.chat.ts` | Next to `index.tsx`. Start maps `api.chat.ts` to `/api/chat`. |

BYOK import:

```ts
import { defineByok, memoryStorage } from '@tanstack/ai-react/byok'
```

Same subpath on `@tanstack/ai-vue/byok`, `ai-solid`, `ai-svelte`, `ai-preact`, `ai-angular`, `ai-octane`, `ai-remix`.

Server POST, in this order:

1. `chatParamsFromRequest` + `getByokKey` + `byokMissing` if empty.
2. `chat({ adapter: createOpenRouterText('openai/gpt-5.5', apiKey), messages, threadId, runId })` then `toServerSentEventsResponse`.

Export `POST` from `api.chat.ts`. Test it with `node:test` in `src/routes/api.chat.test.ts`. Pin a missing-key `401` `{ error: { type: 'byok_missing' } }` with independent literals. Do not add vitest as a new dependency.

## 3. Tutorial page

Load `docs`. Run its persona and tone gates unless this conversation already chose them. Default tone if the user said "match Basic Chat": more casual than Quick Start, second person, short numbered steps.

Page order (do not invert):

1. Create a Start app: `npx @tanstack/cli@latest create`. Then install with package-manager tabs. React-only line, no `@tanstack/ai-client`:

   `react: @tanstack/ai @tanstack/ai-react @tanstack/ai-<adapter>`

2. Short **Client and server** split (browser holds the key and POSTs; the route reads the key and streams).
3. BYOK store file, then key form **in its own file**, export, then say to import it on the index route.
4. `useChat` on `src/routes/index.tsx` (import the form).
5. Server route at `src/routes/api.chat.ts` next to `index.tsx`, two substeps: read the key, then `chat()` + SSE.
6. Try it. Sandbox comment. GitHub link. Optional recipe link.

Sandbox comment (generic; change `slug`):

```html
<!-- ::client-example library=ai framework=react slug=<slug> -->
```

Do not mention Nx, generators, PRs, or rejected file splits in the tutorial. Code on the page must match the example files.

Install tabs: only the `<!-- ::start:tabs variant="package-manager" mode="install" -->` form. See the `docs` skill.

## 4. Nav and pointers

`docs/config.json`:

- Tutorials section `"tab": "tutorial"`, child `tutorials/<slug>`.
- Examples section `"tab": "examples"`, child `framework/react/examples/<slug>`.

Point Overview and Quick Start at the tutorial. Cross-link any recipe that covers the same UI.

`examples/README.md`: list the new example.

## 5. tanstack.com sibling PR

The player is generic. The allowlist is not.

Already on the site (do not redo unless missing on `origin/main`):

- `<!-- ::client-example library framework slug -->` in `MdComponents.tsx`
- `rewriteWorkspaceProtocolDependencies` for `@tanstack/ai*` `workspace:*` → `latest` inside `fetchClientExampleFiles`
- `getExampleStartingPath(..., 'ai')` → `src/routes/index.tsx`

Still one row per slug:

1. Copy the Basic Chat WebContainer row in `src/utils/client-example-config.ts`. Change `slug`. Keep `libraryId: 'ai'`, `framework: 'react'`, `entry: '/src/routes/index.tsx'`, `compatibility: 'tanstack-start-async-context'`, `pnpm install` / `pnpm run dev`.
2. Tests: `tests/repository-example.test.ts` (latest config object; non-latest is `undefined`) and `tests/repo-path.test.ts` if the starting path changed.
3. A Vue / different-entry example needs a matching config row, not a new embed component.

Find the tanstack.com checkout as a sibling folder or worktree. If it is missing, stop and ask. Do not mix this work with unrelated dirty files on that checkout. Branch from `origin/main`.

Two PRs. Push to `origin` on both. Merge the AI PR first so GitHub has `examples/react/<slug>`. Link each PR from the other.

A docs-only tutorial with no live sandbox and no Examples tab item does not need a tanstack.com PR.

## 6. Quality and PRs

- `pnpm --filter <package-name> test:types` and the missing-key test.
- Do not commit `docs/superpowers/`, plans, screenshots, or `.agent/`.
- Example-only / docs / site wiring: no changeset unless a published package changed.
- Conventional commit. No `Co-authored-by`.
- Fill the PR template honestly. Do not tick `test:pr` if it was not run.

## Common mistakes

| Mistake | Fix |
|---|---|
| Leave the app at `examples/<slug>` | Move to `examples/react/<slug>` |
| Ship the full Nx lab | Slim to one adapter and the files in section 2 |
| Extra `handle-chat-post.ts` / `chat-model.ts` | Inline in `api.chat.ts` |
| Install or import `@tanstack/ai-client` | `@tanstack/ai-react/byok` and the framework package root |
| Key form inside `index.tsx` | Own file, export, import |
| `forwardedProps` on a simple BYOK chat | Omit |
| Tutorial starts with the server route | Client BYOK, then `useChat`, then server |
| New slug only in the AI repo | Allowlist row + Examples tab + sandbox comment |
| Mix tanstack.com landing WIP into the sandbox PR | Fresh branch from `origin/main` |
| Nx / "we split the files" in the tutorial | Current design only |
