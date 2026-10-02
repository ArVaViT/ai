---
'@tanstack/ai-anthropic': patch
---

Keep the input and cache token counts of a stream when its closing `message_delta` leaves them out. Some Anthropic-compatible servers send only `output_tokens` there, so `usage` reported 0 input tokens. The adapter now takes each missing count from `message_start`, the same as the Anthropic SDK does.
