import type { NotificationProvider, NotificationEvent } from './types.js'

export function createCompositeNotificationProvider(
  ...providers: NotificationProvider[]
): NotificationProvider {
  return {
    async notify(event: NotificationEvent): Promise<void> {
      await Promise.all(providers.map(p => p.notify(event)))
    },
  }
}
