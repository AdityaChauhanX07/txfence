# @txfence/verify

Formal policy verification for txfence — bounded model checking with
counterexample generation.

## What this does

Given a policy and an invariant, @txfence/verify either proves the invariant
holds (up to a configurable bound) or generates a concrete counterexample —
a specific sequence of transactions and agent interleavings that violates it.

## Properties

- **Rolling window saturation** — can N agents collectively exceed a rolling
  window cap through adversarial scheduling?
- **Absolute cap reachability** — can M transactions reach or exceed the
  absolute cap?
- **Policy containment** — is every action allowed by policy B also allowed
  by policy A?

## Bounded verification

Properties are checked up to a configurable bound. A property that holds
within the bound may still be violated outside it. Always document the bounds
you checked.

Future: Z3 SMT backend for complete proofs (--solver z3 flag, planned).

---

Full project README: https://github.com/AdityaChauhanX07/txfence

