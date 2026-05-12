import type { PolicyVersion } from './types.js'
import type { Policy } from '../types/policy.js'
import { getPolicyVersionId } from './hash.js'

export type PolicyVersionStore = {
  register: (version: PolicyVersion) => void
  get: (id: string) => PolicyVersion | undefined
  list: () => PolicyVersion[]
  getByPolicy: (policy: Policy) => PolicyVersion | undefined
}

export function createPolicyVersionStore(): PolicyVersionStore {
  const versions = new Map<string, PolicyVersion>()

  return {
    register(version: PolicyVersion): void {
      versions.set(version.id, version)
    },

    get(id: string): PolicyVersion | undefined {
      return versions.get(id)
    },

    list(): PolicyVersion[] {
      return [...versions.values()].sort((a, b) => b.createdAt - a.createdAt)
    },

    getByPolicy(policy: Policy): PolicyVersion | undefined {
      const id = getPolicyVersionId(policy)
      return versions.get(id)
    },
  }
}
