export type CapLockResult =
  | { granted: true; lockId: string }
  | { granted: false; reason: 'absolute_cap_exceeded' | 'rolling_window_exceeded' }

export type RollingWindowConfig = {
  windowMs: number
  maxAmount: bigint
  token: string
}

export type AbsoluteCapConfig = {
  maxAmount: bigint
  token: string
}

export type CapConfig = {
  capId: string
  absoluteCap?: AbsoluteCapConfig
  rollingWindow?: RollingWindowConfig
  warningThresholdPct?: number   // 0-100, triggers onCapWarning when this % is reached
}

export type CapWarningEvent = {
  capId: string
  type: 'absolute' | 'rolling_window'
  currentAmount: bigint
  capAmount: bigint
  pctUsed: number
  token: string
}

export type AbsoluteCapInspection = {
  maxAmount: bigint
  token: string
  totalCommitted: bigint
  totalPending: bigint
  remaining: bigint
  pctUsed: number
}

export type RollingWindowInspection = {
  maxAmount: bigint
  token: string
  windowMs: number
  windowStart: number
  totalInWindow: bigint
  totalPending: bigint
  remaining: bigint
  pctUsed: number
  resetsAt: number
}

export type CapInspection = {
  capId: string
  absoluteCap?: AbsoluteCapInspection
  rollingWindow?: RollingWindowInspection
  activeLocks: number
}

export type CapLockProvider = {
  acquire: (capId: string, amount: bigint, token: string) => Promise<CapLockResult>
  release: (capId: string, lockId: string, amount: bigint) => Promise<void>
  commit: (capId: string, lockId: string, amount: bigint) => Promise<void>
  onCapWarning?: (event: CapWarningEvent) => void
  inspect?: (capId: string) => Promise<CapInspection>
}
