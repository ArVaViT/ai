import { describe, expect, it } from 'vitest'
import { deleteRunKey, mintRunKey } from './xai-key.ts'

const NOW = Date.UTC(2026, 8, 18, 0, 0, 0)

function fakeFetch(status: number, body: unknown) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = []
  const send: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init })
    return new Response(JSON.stringify(body), { status })
  }
  return { calls, send }
}

describe('mintRunKey', () => {
  it('creates a key that expires after the job timeout', async () => {
    const { calls, send } = fakeFetch(200, {
      apiKey: 'xai-run',
      apiKeyId: 'id-1',
    })
    const key = await mintRunKey({
      managementKey: 'mgmt',
      teamId: 'team/1',
      fetch: send,
      now: () => NOW,
    })
    expect(key).toEqual({ apiKey: 'xai-run', apiKeyId: 'id-1' })
    expect(calls[0]?.url).toBe(
      'https://management-api.x.ai/auth/teams/team%2F1/api-keys',
    )
    expect(new Headers(calls[0]?.init?.headers).get('authorization')).toBe(
      'Bearer mgmt',
    )
    const sent: unknown = JSON.parse(String(calls[0]?.init?.body))
    expect(sent).toMatchObject({
      expireTime: new Date(NOW + 35 * 60 * 1000).toISOString(),
    })
  })

  it('keeps the response body out of the error', async () => {
    const { send } = fakeFetch(500, { apiKey: 'xai-leak' })
    await expect(
      mintRunKey({ managementKey: 'mgmt', teamId: 't', fetch: send }),
    ).rejects.toThrow(/^xAI key create failed: HTTP 500$/)
  })

  it('rejects a response with no key', async () => {
    const { send } = fakeFetch(200, { apiKeyId: 'id-1' })
    await expect(
      mintRunKey({ managementKey: 'mgmt', teamId: 't', fetch: send }),
    ).rejects.toThrow('no apiKey')
  })
})

describe('deleteRunKey', () => {
  it('deletes by key id', async () => {
    const { calls, send } = fakeFetch(200, {})
    await deleteRunKey({
      managementKey: 'mgmt',
      teamId: 't',
      apiKeyId: 'id-1',
      fetch: send,
    })
    expect(calls[0]?.url).toBe('https://management-api.x.ai/auth/api-keys/id-1')
    expect(calls[0]?.init?.method).toBe('DELETE')
  })

  it('throws on a failed delete', async () => {
    const { send } = fakeFetch(403, {})
    await expect(
      deleteRunKey({
        managementKey: 'mgmt',
        teamId: 't',
        apiKeyId: 'id-1',
        fetch: send,
      }),
    ).rejects.toThrow('HTTP 403')
  })
})
