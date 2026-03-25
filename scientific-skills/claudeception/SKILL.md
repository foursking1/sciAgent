---
name: claudeception
description: Capture and persist newly-discovered debugging techniques or project-specific knowledge by wrapping the Claudeception skill. Use when you want Claude Code to automatically extract skills from successful investigations, set up the mandatory evaluation hook, or manage the Claudeception repo from a project workspace.
github_url: https://github.com/blader/Claudeception
github_hash: 62dbb91d1183a866b5cf40079265c825b2695843
version: 0.1.0
created_at: 2026-03-12T14:57:40.514745
entry_point: scripts/wrapper.py
dependencies:
  - git>=2.34
  - bash
---

# Claudeception Skill

Claudeception teaches Claude Code how to keep the hard-earned lessons from prior sessions. Whenever you finish a task that required true discovery (debugging, novel workaround, environment spelunking), this skill runs a retrospective and, when warranted, writes a brand-new skill optimized for future retrieval.

## Quick Start

1. **Install + hook (automatic)**
   ```
   python scientific-skills/claudeception/scripts/wrapper.py install --scope user
   ```
   - `--scope user` installs into `~/.claude`; use `--scope project --project-root <repo>` for per-repo installs.
   - The script clones/updates `claudeception` under `.claude/skills`, copies `claudeception-activator.sh` into `.claude/hooks`, and amends `.claude/settings.json` so the hook fires on every `UserPromptSubmit`.
2. **Restart the Codex session** so the new hook is evaluated.
3. **Work as usual.** At the end of each request the hook prints a reminder forcing you to ask, "did we learn something worth persisting?" and, if yes, to call the skill.

> Manual install: `git clone https://github.com/blader/Claudeception.git ~/.claude/skills/claudeception`, copy `scripts/claudeception-activator.sh` into `~/.claude/hooks/`, `chmod +x`, and merge the JSON snippet from the README into `.claude/settings.json`. Repeat with relative paths for project scope.

## When to Trigger Claudeception

- Debugs that required multi-step investigation or instrumentation
- Workarounds discovered through trial-and-error rather than documentation
- Environment- or project-specific rituals (custom build flags, flaky data fixes)
- Anything that would help another engineer hitting the same issue later

If none of the above happened, acknowledge the hook and move on. Otherwise call:

```
/claudeception
```

or explicitly instruct: "Save what we just learned as a skill."

## Extraction Workflow

1. Describe the trigger: include exact error text, stack traces, or symptoms.
2. Capture the discovery path: what diagnostics you ran, which dead-ends you hit, what ultimately worked.
3. Write the reusable fix: precise steps or code changes. Avoid vague advice.
4. Verification: show how to confirm the fix (tests, logs, status commands).

Use `references/skill-template.md` as the canonical scaffold when converting discoveries into skills. It enforces descriptive names, trigger conditions, solutions, verification, and examples.

### Quality Gates

- Must be reproducible and verified in the current session.
- Should generalize to future instances (not a one-off).
- No secrets or proprietary IDs.
- Prefer precise activation phrases ("Fix for PrismaClientKnownRequestError in Vercel serverless") over broad descriptions.

## Maintenance & CLI Helper

- `python .../wrapper.py install --scope user` - install or update user-level setup.
- `python .../wrapper.py install --scope project --project-root <repo>` - pin Claudeception to a single repo (useful for client work).
- `python .../wrapper.py --help` - view options. The script auto-detects existing clones and runs `git pull` instead of re-cloning.
- To update manually: `git -C ~/.claude/skills/claudeception pull`.

## Files in This Skill

- `scripts/wrapper.py` - automation for cloning, copying the activator hook, and editing `.claude/settings.json`.
- `references/skill-template.md` - concise template for drafting new skills before saving them to the skills directory.

Keep this skill loaded whenever you expect to learn something non-trivial. The faster you capture those discoveries, the fewer times you (or future agents) will have to rediscover them.