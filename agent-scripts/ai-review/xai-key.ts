/**
 * Mint one short-lived xAI API key per review run.
 *
 * The sandbox runs PR code with network access, so any key it holds can be
 * stolen. The management key stays on the host. The sandbox gets a key that
 * expires soon after the job timeout and is deleted when the run ends.
 */

const MANAGEMENT_API = 'https://management-api.x.ai'

/** Longer than the 30 minute job timeout in `.github/workflows/ai-review.yml`. */
const RUN_KEY_TTL_MS = 35 * 60 * 1000

export type RunKey = { apiKey: string; apiKeyId: string }

export type RunKeyOptions = {
  managementKey: string
  teamId: string
  fetch?: typeof fetch
  now?: () => number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Create a key that expires by itself. A cancelled job never reaches
 * `deleteRunKey`, so `expireTime` is the control and delete is cleanup.
 */
export async function mintRunKey(opts: RunKeyOptions): Promise<RunKey> {
  const send = opts.fetch ?? fetch
  const now = opts.now ?? Date.now
  const response = await send(
    `${MANAGEMENT_API}/auth/teams/${encodeURIComponent(opts.teamId)}/api-keys`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${opts.managementKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: `ai-review-${String(now())}`,
        // ponytail: wildcard ACLs. Narrow to the one model and endpoint the
        // Grok CLI uses after a live run shows their names.
        acls: ['api-key:model:*', 'api-key:endpoint:*'],
        expireTime: new Date(now() + RUN_KEY_TTL_MS).toISOString(),
      }),
    },
  )
  // Never put the response body in an error. It can hold the new key.
  if (!response.ok) {
    throw new Error(`xAI key create failed: HTTP ${String(response.status)}`)
  }
  const body: unknown = await response.json()
  if (
    !isRecord(body) ||
    typeof body.apiKey !== 'string' ||
    body.apiKey.length === 0 ||
    typeof body.apiKeyId !== 'string' ||
    body.apiKeyId.length === 0
  ) {
    throw new Error('xAI key create returned no apiKey or apiKeyId')
  }
  return { apiKey: body.apiKey, apiKeyId: body.apiKeyId }
}

export async function deleteRunKey(
  opts: RunKeyOptions & { apiKeyId: string },
): Promise<void> {
  const send = opts.fetch ?? fetch
  const response = await send(
    `${MANAGEMENT_API}/auth/api-keys/${encodeURIComponent(opts.apiKeyId)}`,
    {
      method: 'DELETE',
      headers: { authorization: `Bearer ${opts.managementKey}` },
    },
  )
  if (!response.ok) {
    throw new Error(`xAI key delete failed: HTTP ${String(response.status)}`)
  }
}
