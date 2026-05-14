// Main verification entry point.
// Dispatches to the appropriate property checker based on property.kind.

import type { VerificationProperty, VerificationResult } from './types.js'
import { checkRollingWindowSaturation } from './properties/rolling-window.js'
import { checkAbsoluteCapReachability } from './properties/absolute-cap.js'
import { checkPolicyContainment } from './properties/policy-contains.js'

export function verify(property: VerificationProperty): VerificationResult {
  switch (property.kind) {
    case 'rolling_window_saturation':
      return checkRollingWindowSaturation(property)
    case 'absolute_cap_reachability':
      return checkAbsoluteCapReachability(property)
    case 'policy_containment':
      return checkPolicyContainment(property)
  }
}

export async function verifyAll(
  properties: VerificationProperty[],
): Promise<VerificationResult[]> {
  return Promise.all(properties.map(p => Promise.resolve(verify(p))))
}
