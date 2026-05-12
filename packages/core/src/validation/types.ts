export type ConfigWarningSeverity = 'error' | 'warning'

export type ConfigWarning = {
  field: string
  message: string
  severity: ConfigWarningSeverity
}

export type ConfigValidationResult = {
  valid: boolean
  errors: ConfigWarning[]
  warnings: ConfigWarning[]
}
