---
'@tanstack/ai': patch
'@tanstack/ai-client': patch
---

Run client tools that an AG-UI server leaves pending on a success `RUN_FINISHED`. The AG-UI spec ends a run that calls a frontend tool with a success outcome, not an interrupt. Pydantic AI's `AGUIAdapter` does this, so `useChat` showed the tool call and then stopped. The client now runs each call that this run started and did not answer, or, when the server names them in `outcome.pendingToolCallIds`, the named calls that this run started. Then it continues the conversation with the results. A client tool with `needsApproval: true` does not run on this path.
