import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import type { GitHubClient } from '../../scripts/maintainer/github.ts'
import { parseReviewEvent, resolveReviewEvent } from './event'

function workflowFixture(
  options: {
    duplicate?: boolean
    stale?: boolean
    wrongWorkflow?: boolean
    secondPage?: boolean
    noCandidate?: boolean
    wrongRepo?: boolean
    wrongBranch?: boolean
  } = {},
) {
  const sha = 'a'.repeat(40)
  const pull = {
    number: 42,
    state: 'open',
    title: 'Change source',
    body: null,
    html_url: 'https://github.com/TanStack/ai/pull/42',
    draft: false,
    maintainer_can_modify: false,
    user: { login: 'alice' },
    labels: [],
    base: {
      sha: 'b'.repeat(40),
      ref: 'main',
      repo: { full_name: 'TanStack/ai' },
    },
    head: { sha, ref: 'feature', repo: { full_name: 'alice/ai' } },
  }
  const pages: Array<string> = []
  const client = {
    graphql() {
      throw new Error('unused')
    },
    async rest(method, path) {
      if (method !== 'GET') throw new Error('unexpected mutation')
      if (path.endsWith('/actions/runs/123'))
        return {
          id: 123,
          workflow_id: options.wrongWorkflow ? 8 : 7,
          event: 'pull_request',
          status: 'completed',
          conclusion: 'success',
          repository: { full_name: options.wrongRepo ? 'other/ai' : 'TanStack/ai' },
          head_repository: { full_name: 'alice/ai' },
          head_branch: options.wrongBranch ? 'other-branch' : 'feature',
          head_sha: sha,
        }
      if (path.endsWith('/actions/workflows/ai-review-signal.yml'))
        return { id: 7, path: '.github/workflows/ai-review-signal.yml' }
      if (path.includes('/commits/')) {
        pages.push(path)
        if (options.noCandidate) return []
        if (options.secondPage && path.endsWith('page=1'))
          return Array.from({ length: 100 }, (_, index) => ({
            ...pull,
            number: index + 100,
            state: 'closed',
          }))
        return options.duplicate ? [pull, { ...pull, number: 43 }] : [pull]
      }
      if (path.endsWith('/pulls/42'))
        return options.stale
          ? { ...pull, head: { ...pull.head, sha: 'c'.repeat(40) } }
          : pull
      throw new Error(`unexpected ${path}`)
    },
  } satisfies GitHubClient
  return { client, pages }
}

describe('resolveReviewEvent', () => {
  it('resolves a fork with no event PR list and reads all candidate pages', async () => {
    const { client, pages } = workflowFixture({ secondPage: true })
    const result = await resolveReviewEvent({
      client,
      repo: 'TanStack/ai',
      eventName: 'workflow_run',
      event: { workflow_run: { id: 123, pull_requests: [] } },
    })
    expect(result.parsed).toEqual({
      prNumber: 42,
      mode: 'auto',
      commentAuthor: null,
      eventName: 'workflow_run',
    })
    expect(result.pr.headRepo).toBe('alice/ai')
    expect(pages).toHaveLength(2)
  })

  it.each([{ duplicate: true }, { stale: true }, { wrongWorkflow: true }, { noCandidate: true }, { wrongRepo: true }, { wrongBranch: true }])(
    'rejects ambiguous, stale, or unrelated runs',
    async (options) => {
      const { client } = workflowFixture(options)
      await expect(
        resolveReviewEvent({
          client,
          repo: 'TanStack/ai',
          eventName: 'workflow_run',
          event: { workflow_run: { id: 123, pull_requests: [{ number: 99 }] } },
        }),
      ).rejects.toThrow(/workflow_run/)
    },
  )

  it('keeps status labels out of the signal and concurrency behind the review guard', async () => {
    const signal = await readFile(
      new URL('../../.github/workflows/ai-review-signal.yml', import.meta.url),
      'utf8',
    )
    const review = await readFile(
      new URL('../../.github/workflows/ai-review.yml', import.meta.url),
      'utf8',
    )
    expect(signal).toContain('types: [opened, synchronize, ready_for_review]')
    expect(signal).not.toContain('labeled')
    expect(review).not.toMatch(/^concurrency:/m)
    expect(review).toContain('    concurrency:')
    expect(review).toContain("github.event.label.name == 'ai-review'")
    expect(review).toContain("github.ref == 'refs/heads/main'")
    expect(review).toContain('          ref: main')
    expect(review).toContain('          persist-credentials: false')
  })
})

describe('parseReviewEvent', () => {
  it('parses pull_request as auto', () => {
    expect(
      parseReviewEvent({
        eventName: 'pull_request',
        event: { pull_request: { number: 42 } },
      }),
    ).toEqual({
      prNumber: 42,
      mode: 'auto',
      commentAuthor: null,
      eventName: 'pull_request',
    })
  })

  it('parses a pull_request labeled ai-review as manual', () => {
    expect(
      parseReviewEvent({
        eventName: 'pull_request',
        event: {
          action: 'labeled',
          label: { name: 'ai-review' },
          sender: { login: 'alem' },
          pull_request: { number: 42 },
        },
      }),
    ).toEqual({
      prNumber: 42,
      mode: 'manual',
      commentAuthor: 'alem',
      eventName: 'pull_request',
    })
  })

  it('parses a pull_request_target labeled ai-review as manual', () => {
    expect(
      parseReviewEvent({
        eventName: 'pull_request_target',
        event: {
          action: 'labeled',
          label: { name: 'ai-review' },
          sender: { login: 'alem' },
          pull_request: { number: 42 },
        },
      }),
    ).toEqual({
      prNumber: 42,
      mode: 'manual',
      commentAuthor: 'alem',
      eventName: 'pull_request_target',
    })
  })

  it('parses a plain pull_request_target as auto', () => {
    expect(
      parseReviewEvent({
        eventName: 'pull_request_target',
        event: { pull_request: { number: 42 } },
      }),
    ).toEqual({
      prNumber: 42,
      mode: 'auto',
      commentAuthor: null,
      eventName: 'pull_request_target',
    })
  })
  it('parses a pull_request labeled with another name as auto', () => {
    expect(
      parseReviewEvent({
        eventName: 'pull_request',
        event: {
          action: 'labeled',
          label: { name: 'bug' },
          pull_request: { number: 42 },
        },
      }),
    ).toEqual({
      prNumber: 42,
      mode: 'auto',
      commentAuthor: null,
      eventName: 'pull_request',
    })
  })

  it('requires authenticated workflow_run resolution', () => {
    expect(() =>
      parseReviewEvent({ eventName: 'workflow_run', event: {} }),
    ).toThrow('requires authenticated resolution')
  })
  it('parses workflow_dispatch string pr_number as manual', () => {
    expect(
      parseReviewEvent({
        eventName: 'workflow_dispatch',
        event: { inputs: { pr_number: '88' } },
      }),
    ).toEqual({
      prNumber: 88,
      mode: 'manual',
      commentAuthor: null,
      eventName: 'workflow_dispatch',
    })
  })

  it('parses workflow_dispatch numeric pr_number as manual', () => {
    expect(
      parseReviewEvent({
        eventName: 'workflow_dispatch',
        event: { inputs: { pr_number: 7 } },
      }),
    ).toEqual({
      prNumber: 7,
      mode: 'manual',
      commentAuthor: null,
      eventName: 'workflow_dispatch',
    })
  })

  it('parses issue_comment on a PR as manual', () => {
    expect(
      parseReviewEvent({
        eventName: 'issue_comment',
        event: {
          issue: {
            number: 12,
            pull_request: {
              url: 'https://api.github.com/repos/TanStack/ai/pulls/12',
            },
          },
          comment: { user: { login: 'alem' } },
        },
      }),
    ).toEqual({
      prNumber: 12,
      mode: 'manual',
      commentAuthor: 'alem',
      eventName: 'issue_comment',
    })
  })

  it('returns a null commentAuthor when the comment user is missing', () => {
    expect(
      parseReviewEvent({
        eventName: 'issue_comment',
        event: {
          issue: { number: 12, pull_request: {} },
          comment: {},
        },
      }),
    ).toEqual({
      prNumber: 12,
      mode: 'manual',
      commentAuthor: null,
      eventName: 'issue_comment',
    })
  })

  it('throws on an unknown event name', () => {
    expect(() => parseReviewEvent({ eventName: 'push', event: {} })).toThrow(
      'Unknown GitHub event: push',
    )
  })

  it('throws when workflow_dispatch has no valid pr_number', () => {
    expect(() =>
      parseReviewEvent({
        eventName: 'workflow_dispatch',
        event: { inputs: { pr_number: 'nope' } },
      }),
    ).toThrow('workflow_dispatch is missing a valid inputs.pr_number')
  })

  it('throws when issue_comment is not on a pull request', () => {
    expect(() =>
      parseReviewEvent({
        eventName: 'issue_comment',
        event: {
          issue: { number: 12 },
          comment: { user: { login: 'alem' } },
        },
      }),
    ).toThrow('issue_comment is not on a pull request')
  })

  it('throws when pull_request is missing a number', () => {
    expect(() =>
      parseReviewEvent({
        eventName: 'pull_request',
        event: { pull_request: {} },
      }),
    ).toThrow('pull_request event is missing pull_request.number')
  })
})
