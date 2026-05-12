import { createHmac } from 'node:crypto'
import type { NotificationProvider, NotificationEvent } from './types.js'
import { serializeWithBigInt } from '../serialization/bigint.js'

export type WebhookNotificationOptions = {
  secret?: string
  timeoutMs?: number
  headers?: Record<string, string>
}

export function createWebhookNotificationProvider(
  url: string,
  options?: WebhookNotificationOptions,
): NotificationProvider {
  const timeoutMs = options?.timeoutMs ?? 5000
  const extraHeaders = options?.headers ?? {}

  return {
    async notify(event: NotificationEvent): Promise<void> {
      const payload = serializeWithBigInt(event)

      const headers: Record<string, string> = {
        'content-type': 'application/json',
        'x-txfence-event': event.kind,
        ...extraHeaders,
      }

      if (options?.secret !== undefined) {
        const sig = createHmac('sha256', options.secret).update(payload).digest('hex')
        headers['x-txfence-signature'] = sig
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      try {
        await fetch(url, {
          method: 'POST',
          headers,
          body: payload,
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timer)
      }
    },
  }
}
