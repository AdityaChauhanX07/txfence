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
}

export type CapLockProvider = {
  acquire: (capId: string, amount: bigint, token: string) => Promise<CapLockResult>
  release: (capId: string, lockId: string, amount: bigint) => Promise<void>
  commit: (capId: string, lockId: string, amount: bigint) => Promise<void>
}
