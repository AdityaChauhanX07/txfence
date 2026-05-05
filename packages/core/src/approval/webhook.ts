// The poll endpoint must accept:
//   GET  pollUrl?token={token}  -> { decision: 'approved' | 'rejected' | null }
//   GET  pollUrl?token={token}&decision=approved  -> records decision, returns { decision: 'approved' }
//   GET  pollUrl?token={token}&decision=rejected  -> records decision, returns { decision: 'rejected' }
// The approveUrl and rejectUrl in the ApprovalRequest payload point to
// pollUrl?token={token}&decision=approved and pollUrl?token={token}&decision=rejected respectively.
// These can be embedded in email notifications for one-click approval.
// Verify X-TXFence-Signature using HMAC-SHA256 before trusting the webhook payload.

import { createHmac } from 'node:crypto'
import type { ApprovalProvider, ApprovalRequest, ApprovalDecision } from './types.js'

export type WebhookApprovalOptions = {
  webhookSecret?: string
  pollIntervalMs?: number
}

async function signPayload(payload: string, secret: string): Promise<string> {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export function createWebhookApprovalProvider(
  webhookUrl: string,
  pollUrl: string,
  options?: WebhookApprovalOptions,
): ApprovalProvider {
  return {
    async request(req: ApprovalRequest): Promise<void> {
      req.approveUrl = pollUrl + '?token=' + req.token + '&decision=approved'
      req.rejectUrl = pollUrl + '?token=' + req.token + '&decision=rejected'

      const body = JSON.stringify(req)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (options?.webhookSecret !== undefined) {
        const sig = await signPayload(body, options.webhookSecret)
        headers['X-TXFence-Signature'] = sig
      }

      const response = await fetch(webhookUrl, { method: 'POST', headers, body })
      if (!response.ok) {
        throw new Error('webhook dispatch failed: ' + response.status)
      }
    },

    async poll(token: string): Promise<ApprovalDecision | null> {
      const response = await fetch(pollUrl + '?token=' + token)
      if (response.status === 404) return null
      if (!response.ok) throw new Error('poll failed: ' + response.status)
      const data = await response.json() as { decision: ApprovalDecision | null }
      return data.decision
    },
  }
}
