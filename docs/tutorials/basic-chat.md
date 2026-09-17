---
title: Basic Chat
id: basic-chat
order: 1
description: "Build a streaming React chat on TanStack Start. A server route streams tokens, useChat renders them, and BYOK keeps the OpenRouter key in the tab."
keywords:
  - tanstack ai
  - tutorial
  - basic chat
  - useChat
  - byok
  - openrouter
  - tanstack start
---

Build a streaming chat. Keep the OpenRouter key off the server.

A Start route streams tokens. The client uses `useChat`. BYOK keeps the key in this tab.

Copy the files below. Or open the live sandbox. Paste a key there.

This tutorial is React + Start. For other frameworks, open [Quick Start](../getting-started/quick-start).

> [!TIP]
> The app uses `@tanstack/ai`, `@tanstack/ai-react`, `@tanstack/ai-openrouter`, and `@tanstack/ai-client`. OpenRouter keys come from [openrouter.ai](https://openrouter.ai).

## 1. Stream from a Start route

Put the model id in `src/lib/chat-model.ts`:

```typescript
export const CHAT_MODEL = 'openai/gpt-4o'
```

Put this handler in `src/lib/handle-chat-post.ts`. It reads the chat body and the OpenRouter key. Then it returns an SSE stream.

```typescript
import {
  chat,
  chatParamsFromRequest,
  toServerSentEventsResponse,
} from '@tanstack/ai'
import { createOpenRouterText } from '@tanstack/ai-openrouter'
import { openrouterByok } from '@tanstack/ai-openrouter/byok'
import { byokMissing, getByokKey } from '@tanstack/ai/byok/server'
import { CHAT_MODEL } from './chat-model'

export async function handleChatPost(request: Request) {
  const params = await chatParamsFromRequest(request)
  const apiKey = getByokKey(request, openrouterByok)
  if (!apiKey) return byokMissing(openrouterByok)

  const stream = chat({
    adapter: createOpenRouterText(CHAT_MODEL, apiKey),
    messages: params.messages,
    threadId: params.threadId,
    runId: params.runId,
  })
  return toServerSentEventsResponse(stream)
}
```

If the key is missing, `byokMissing` returns HTTP 401.

Mount the handler on `POST /api/chat` in `src/routes/api.chat.ts`:

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { handleChatPost } from '../lib/handle-chat-post'

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: ({ request }) => handleChatPost(request),
    },
  },
})
```

## 2. Render with `useChat`

Call `useChat` on the home route with:

- `connection`: `fetchServerSentEvents('/api/chat')`
- `byok`: the BYOK store
- `forwardedProps`: provider `openrouter` and model `openai/gpt-4o`

Put this in `src/routes/index.tsx`. The `byok` import is the next file.

```tsx
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { openrouterByok } from '@tanstack/ai-openrouter/byok'
import {
  fetchServerSentEvents,
  useByok,
  useChat,
} from '@tanstack/ai-react'
import { byok } from '@/lib/byok'
import { CHAT_MODEL } from '@/lib/chat-model'

const forwardedProps = {
  provider: 'openrouter',
  model: CHAT_MODEL,
}

function OpenRouterKeyForm() {
  const snapshot = useByok(byok)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const status = snapshot.status[openrouterByok.id]
  const masked = status && 'masked' in status ? status.masked : undefined
  const missingKey = snapshot.prompt?.reason === 'missing'

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const next = draft.trim()
        if (!next) return
        setError('')
        void byok
          .update(openrouterByok.id, next)
          .then(() => setDraft(''))
          .catch((caught: unknown) =>
            setError(
              caught instanceof Error ? caught.message : 'Could not save key',
            ),
          )
      }}
    >
      <input
        type="password"
        autoComplete="off"
        placeholder={masked ? `Saved ${masked}` : 'Paste your OpenRouter key'}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <button type="submit" disabled={!draft.trim()}>
        Save key
      </button>
      {missingKey ? (
        <p>Paste an OpenRouter key, then send again.</p>
      ) : null}
      {error ? <p>{error}</p> : null}
    </form>
  )
}

function ChatPage() {
  const [input, setInput] = useState('')
  const { messages, sendMessage, isLoading, error, stop } = useChat({
    connection: fetchServerSentEvents('/api/chat'),
    byok,
    forwardedProps,
  })

  const handleSendMessage = () => {
    if (!input.trim()) return
    sendMessage(input.trim())
    setInput('')
  }

  return (
    <div>
      <OpenRouterKeyForm />
      {messages.map((message) => (
        <div key={message.id}>
          {message.parts.map((part, index) =>
            part.type === 'text' ? <p key={index}>{part.content}</p> : null,
          )}
        </div>
      ))}
      {error ? <p>{error.message}</p> : null}
      {isLoading ? (
        <button type="button" onClick={stop}>
          Stop
        </button>
      ) : null}
      <textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        disabled={isLoading}
      />
      <button
        type="button"
        onClick={handleSendMessage}
        disabled={!input.trim() || isLoading}
      >
        Send
      </button>
    </div>
  )
}

export const Route = createFileRoute('/')({
  component: ChatPage,
})
```

`messages` updates as tokens arrive. Click Stop to cancel.

## 3. Keep the key in the tab

Create `src/lib/byok.ts`. `memoryStorage()` keeps the key in this tab.

```typescript
import { defineByok, memoryStorage } from '@tanstack/ai-client/byok'
import { openrouterByok } from '@tanstack/ai-openrouter/byok'

export const byok = defineByok({
  storage: memoryStorage(),
  providers: [openrouterByok],
})
```

The paste field saves with `byok.update(openrouterByok.id, next)`. `useChat` sends that key on an `x-byok-*` header.

If you want passkeys, open [Bring Your Own Key](../advanced/byok).

## 4. Try it live

Paste an OpenRouter key in the sandbox. Send a message. Tokens stream into the UI.

The same app is on the Examples tab at `/ai/latest/docs/framework/react/examples/basic-chat`.

<!-- ::client-example library=ai framework=react slug=basic-chat -->

You have a streaming chat. The OpenRouter key never sits in a server env file.

For a headless chat UI, open [A chat box with no tools](../ui/recipes/basic-chat).
