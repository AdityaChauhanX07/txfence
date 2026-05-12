import type { Action, BoundAction } from '../types/action.js'
import type { Policy } from '../types/policy.js'
import type { PolicyEvaluation, PolicyRejectionReason } from '../types/receipt.js'
import type { SimulationResult } from '../types/simulation.js'
import { evaluate } from './evaluate.js'

export type PolicyLeaf = {
  kind: 'leaf'
  policy: Policy
  label?: string
}

export type PolicyAnd = {
  kind: 'and'
  children: PolicyNode[]
  label?: string
}

export type PolicyOr = {
  kind: 'or'
  children: PolicyNode[]
  label?: string
}

export type PolicyNode = PolicyLeaf | PolicyAnd | PolicyOr

export type PolicyNodeEvaluation = {
  passed: boolean
  nodeKind: 'leaf' | 'and' | 'or'
  label?: string
  leaf?: PolicyEvaluation
  children?: PolicyNodeEvaluation[]
  // The first failing reason in the tree — undefined when passed
  firstRejectionReason?: PolicyRejectionReason
}

export function policyLeaf(policy: Policy, label?: string): PolicyLeaf {
  return label !== undefined ? { kind: 'leaf', policy, label } : { kind: 'leaf', policy }
}

export function policyAnd(children: PolicyNode[], label?: string): PolicyAnd {
  return label !== undefined ? { kind: 'and', children, label } : { kind: 'and', children }
}

export function policyOr(children: PolicyNode[], label?: string): PolicyOr {
  return label !== undefined ? { kind: 'or', children, label } : { kind: 'or', children }
}

export function evaluateNode(
  node: PolicyNode,
  action: Action,
  simulationResult?: SimulationResult,
): PolicyNodeEvaluation {
  switch (node.kind) {
    case 'leaf': {
      const boundAction: BoundAction = { action, policy: node.policy }
      const leafEval = evaluate(boundAction, simulationResult)
      return {
        passed: leafEval.passed,
        nodeKind: 'leaf',
        leaf: leafEval,
        ...(node.label !== undefined ? { label: node.label } : {}),
        ...(leafEval.rejectionReason !== undefined
          ? { firstRejectionReason: leafEval.rejectionReason }
          : {}),
      }
    }

    case 'and': {
      if (node.children.length === 0) {
        return {
          passed: true,
          nodeKind: 'and',
          children: [],
          ...(node.label !== undefined ? { label: node.label } : {}),
        }
      }
      const childResults = node.children.map(child =>
        evaluateNode(child, action, simulationResult),
      )
      const allPassed = childResults.every(r => r.passed)
      const firstFailed = childResults.find(r => !r.passed)
      const reason = allPassed ? undefined : firstFailed?.firstRejectionReason
      return {
        passed: allPassed,
        nodeKind: 'and',
        children: childResults,
        ...(node.label !== undefined ? { label: node.label } : {}),
        ...(reason !== undefined ? { firstRejectionReason: reason } : {}),
      }
    }

    case 'or': {
      if (node.children.length === 0) {
        return {
          passed: false,
          nodeKind: 'or',
          children: [],
          ...(node.label !== undefined ? { label: node.label } : {}),
        }
      }
      const childResults = node.children.map(child =>
        evaluateNode(child, action, simulationResult),
      )
      const anyPassed = childResults.some(r => r.passed)
      const reason = anyPassed ? undefined : childResults[0]?.firstRejectionReason
      return {
        passed: anyPassed,
        nodeKind: 'or',
        children: childResults,
        ...(node.label !== undefined ? { label: node.label } : {}),
        ...(reason !== undefined ? { firstRejectionReason: reason } : {}),
      }
    }
  }
}
