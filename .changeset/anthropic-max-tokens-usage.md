---
'@tanstack/ai-anthropic': patch
---

Report token usage when a streamed response stops at `max_tokens`. The `RUN_ERROR` with `code: 'max_tokens'` now carries `usage`, the same as `RUN_FINISHED` does for the other stop reasons. Anthropic bills these tokens, so code that counts `usage` no longer misses them.
