import { createFileRoute } from '@tanstack/react-router'
import { handleChatPost } from '../lib/handle-chat-post'

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: ({ request }) => handleChatPost(request),
    },
  },
})
