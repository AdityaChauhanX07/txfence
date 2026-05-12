import type { TelemetryProvider, Span } from './types.js'

const noopSpan: Span = {
  setAttribute: () => {},
  setStatus: () => {},
  end: () => {},
}

export const noopTelemetry: TelemetryProvider = {
  startSpan: () => noopSpan,
}
