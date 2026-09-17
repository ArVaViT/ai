import { useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { openrouterByok } from '@tanstack/ai-openrouter/byok'
import {
  fetchServerSentEvents,
  useByok,
  useChat,
  type UIMessage,
} from '@tanstack/ai-react'
import { byok } from '@/lib/byok'
import { CHAT_MODEL } from '@/lib/chat-model'

const forwardedProps = {
  provider: 'openrouter',
  model: CHAT_MODEL,
}

function Messages({ messages }: { messages: Array<UIMessage> }) {
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const visibleMessages = messages.filter((message) =>
    message.parts.some((part) => part.type === 'text' && part.content.trim()),
  )

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight
    }
  }, [visibleMessages])

  if (!visibleMessages.length) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-2 text-xl font-semibold text-white">Basic Chat</h2>
          <p className="text-sm text-gray-400">
            Paste an OpenRouter key. Then send a message.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={messagesContainerRef}
      className="flex-1 overflow-y-auto px-4 py-4"
    >
      {visibleMessages.map((message) => (
        <div
          key={message.id}
          className={`mb-2 rounded-lg p-4 ${
            message.role === 'assistant'
              ? 'bg-linear-to-r from-orange-500/5 to-red-600/5'
              : 'bg-transparent'
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-medium text-white ${
                message.role === 'assistant'
                  ? 'bg-linear-to-r from-orange-500 to-red-600'
                  : 'bg-gray-700'
              }`}
            >
              {message.role === 'assistant' ? 'AI' : 'U'}
            </div>
            <div className="min-w-0 flex-1">
              {message.parts.map((part, index) => {
                if (part.type === 'text' && part.content) {
                  return (
                    <div
                      key={`text-${index}`}
                      className="whitespace-pre-wrap text-white"
                    >
                      {part.content}
                    </div>
                  )
                }
                return null
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
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
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
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
      <label className="sr-only" htmlFor="openrouter-key">
        OpenRouter API key
      </label>
      <input
        id="openrouter-key"
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder={masked ? `Saved ${masked}` : 'Paste your OpenRouter key'}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-orange-500/20 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!draft.trim()}
          className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Save key
        </button>
        {masked ? (
          <button
            type="button"
            className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-200"
            onClick={() => {
              setError('')
              void byok
                .clear(openrouterByok.id)
                .catch((caught: unknown) =>
                  setError(
                    caught instanceof Error
                      ? caught.message
                      : 'Could not clear key',
                  ),
                )
            }}
          >
            Clear
          </button>
        ) : null}
      </div>
      {missingKey ? (
        <p className="text-xs text-amber-400">
          Paste an OpenRouter key, then send again.
        </p>
      ) : null}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
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
    <div className="flex h-screen bg-gray-900">
      <div className="flex w-full flex-col">
        <div className="border-b border-orange-500/20 bg-gray-800 px-4 py-3">
          <OpenRouterKeyForm />
        </div>

        <Messages messages={messages} />

        {error ? (
          <div className="mx-4 mt-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            {error.message}
          </div>
        ) : null}

        <div className="border-t border-orange-500/10 bg-gray-900/80">
          <div className="w-full px-4 py-3">
            {isLoading ? (
              <div className="mb-3 flex items-center justify-center">
                <button
                  type="button"
                  onClick={stop}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Stop
                </button>
              </div>
            ) : null}
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Type a message..."
                className="w-full resize-none rounded-lg border border-orange-500/20 bg-gray-800/50 px-4 py-3 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                rows={1}
                disabled={isLoading}
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' &&
                    !event.shiftKey &&
                    input.trim()
                  ) {
                    event.preventDefault()
                    handleSendMessage()
                  }
                }}
              />
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={!input.trim() || isLoading}
                className="rounded-lg bg-orange-500 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/')({
  component: ChatPage,
})
