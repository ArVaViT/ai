import { test, expect } from './fixtures'

/**
 * Wire-format verification for `claude-opus-5` structured output with tools.
 *
 * `claude-opus-5` shipped with `supports.tools: []` and was absent from
 * `ANTHROPIC_COMBINED_TOOLS_AND_SCHEMA_MODELS`, so
 * `supportsCombinedToolsAndSchema()` returned `false` and
 * `chat({ outputSchema, tools })` fell back to the forced-tool-use path kept
 * for pre-4.5 models: a second upstream call carrying a `structured_output`
 * tool, and no `output_config.format` on the streaming request.
 *
 * `/api/anthropic-opus-5-combined-wire` drives the adapter through a custom
 * `fetch` that records every outgoing request, so the three observable
 * consequences of the fix can be asserted without a real Anthropic key.
 */
type WireResponse = {
  ok: boolean
  error?: string
  capturedRequests: Array<{
    url: string
    body: Record<string, unknown> | null
  }>
}

async function runRoute(request: {
  post: (url: string) => Promise<{
    ok: () => boolean
    json: () => Promise<unknown>
  }>
}): Promise<WireResponse> {
  const res = await request.post('/api/anthropic-opus-5-combined-wire')
  expect(res.ok()).toBe(true)
  const payload = (await res.json()) as WireResponse
  if (!payload.ok) {
    throw new Error(`Route failed: ${payload.error}`)
  }
  return payload
}

test.describe('anthropic — claude-opus-5 tools + schema wire format', () => {
  test('the schema travels in a single streaming request', async ({
    request,
  }) => {
    const { capturedRequests } = await runRoute(request)

    // The forced-tool-use fallback needs a second round-trip. The native
    // combined path does not.
    expect(capturedRequests).toHaveLength(1)
  })

  test('the request body carries output_config.format as a json_schema', async ({
    request,
  }) => {
    const { capturedRequests } = await runRoute(request)
    const body = capturedRequests[0]?.body

    expect(body).toBeTruthy()
    const outputConfig = body?.['output_config'] as
      | { format?: { type?: string; schema?: Record<string, unknown> } }
      | undefined
    expect(outputConfig?.format?.type).toBe('json_schema')
    expect(outputConfig?.format?.schema).toMatchObject({ type: 'object' })
  })

  test('the same request carries the web_search server tool', async ({
    request,
  }) => {
    const { capturedRequests } = await runRoute(request)
    const body = capturedRequests[0]?.body
    const tools = (body?.['tools'] ?? []) as Array<Record<string, unknown>>

    expect(tools.map((tool) => tool['name'])).toContain('web_search')
    // The fallback path would have sent a `structured_output` function tool
    // instead of a schema.
    expect(tools.map((tool) => tool['name'])).not.toContain('structured_output')
  })
})
