export { verify, verifyAll } from './verify.js'
export { checkRollingWindowSaturation } from './properties/rolling-window.js'
export { checkAbsoluteCapReachability } from './properties/absolute-cap.js'
export { checkPolicyContainment } from './properties/policy-contains.js'
export type {
  VerificationProperty,
  VerificationResult,
  CounterExample,
  CheckBound,
  RollingWindowProperty,
  AbsoluteCapProperty,
  PolicyContainmentProperty,
  TransactionScenario,
  AgentSpec,
} from './types.js'
