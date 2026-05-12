import type { Policy } from '../types/policy.js'

export type PolicyVersion = {
  id: string
  policy: Policy
  createdAt: number
  label?: string
  author?: string
}
