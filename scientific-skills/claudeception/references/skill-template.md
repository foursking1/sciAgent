---
title: Claudeception Skill Template
---

# Claudeception Skill Template

Use this template when Claudeception asks you to persist a new skill. Keep the language concrete and searchable.

## Frontmatter

```
---
name: prisma-connection-pool-exhaustion
description: |
  Fix for PrismaClientKnownRequestError: Too many database connections
  in Vercel/AWS Lambda after ~5 concurrent requests. Use when log shows
  P2024 or "too many connections".
author: Claude Code
version: 1.0.0
date: YYYY-MM-DD
---
```

- `name`: descriptive kebab-case phrase.
- `description`: include precise triggers (error text, stack traces, platforms).

## Body Outline

1. **Problem** - what hurts and why it is non-obvious.
2. **Context / Trigger Conditions** - exact errors, symptoms, environments.
3. **Solution** - numbered or step-by-step directions with code blocks.
4. **Verification** - commands or tests that show the fix worked.
5. **Example** - before/after snippet or concrete scenario.
6. **Notes** - edge cases, related skills, when not to use it.

## Extraction Checklist

- [ ] Problem reproduced and solved during this session.
- [ ] Trigger text copy-pasted from logs or stack traces.
- [ ] Solution verified (tests, curl, CLI output, etc.).
- [ ] No secrets, tokens, or customer names.
- [ ] Skill would help another engineer who sees the same issue months later.

Store the finished markdown file in your skills directory so Claude Code can retrieve it automatically next time.