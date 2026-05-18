# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in txfence, please report it
privately via GitHub's security advisory feature:

https://github.com/AdityaChauhanX07/txfence/security/advisories/new

Do not open a public GitHub issue for security vulnerabilities.

## Response Time

- Acknowledgment within 48 hours
- Initial assessment within 7 days
- Fix timeline communicated within 14 days

## Scope

In scope:
- Policy engine evaluation logic (packages/core/src/engine/)
- Cap lock race conditions (packages/core/src/caps/)
- Cryptographic operations (packages/provenance/src/hash.ts, merkle.ts)
- HMAC signature verification (packages/core/src/approval/)
- Any vulnerability that could cause a policy to approve a transaction it should reject

Out of scope:
- Vulnerabilities in third-party dependencies (report to the dependency maintainer)
- Issues requiring physical access to infrastructure
- Social engineering attacks

## Supported Versions

| Version | Supported |
|---|---|
| 0.x (current) | Yes |

## Disclosure Policy

Coordinated disclosure. We ask for 90 days before public disclosure
to give us time to fix and release a patch.
