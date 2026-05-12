export type SpanStatus = 'ok' | 'error'

export type Span = {
  setAttribute: (key: string, value: string | number | boolean) => void
  setStatus: (status: SpanStatus, message?: string) => void
  end: () => void
}

export type TelemetryProvider = {
  startSpan: (
    name: string,
    attributes?: Record<string, string | number | boolean>
  ) => Span
}
