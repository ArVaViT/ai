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
