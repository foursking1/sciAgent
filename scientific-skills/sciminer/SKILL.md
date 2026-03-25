---
name: sciminer
description: Use when extracting structured data from scientific PDF documents in this project, especially when the session is in data-extraction mode, PDFs are already uploaded, and the workflow should use the local SciMiner skill instead of a generic prompt.
github_url: https://github.com/foursking1/sciminer
github_hash: 969f4917ed0b3ffec76f2946d57c11e5b258cb00
version: 0.1.0
created_at: 2026-03-24T00:00:00Z
entry_point: scripts/wrapper.py
dependencies:
  - paddleocr==2.8.1
  - paddlepaddle==2.6.2
---

# SciMiner Skill

SciMiner is the local project skill for extracting structured data from scientific PDF documents. In this repository, data-extraction mode should target this local skill under `scientific-skills/sciminer` rather than relying on a vague prompt or external marketplace installation.

## Use when

- The current session is switched to `data-extraction`
- The user has uploaded one or more PDF files to the workspace
- The goal is to extract structured data into CSV outputs
- The workflow should stay inside this project and use the bundled skill
- The agent needs a schema-driven extraction flow with visible intermediate progress

## Core workflow

1. Confirm PDFs exist in the current workspace.
2. Determine schema:
   - If user explicitly names one, use it.
   - Otherwise auto-judge the most appropriate schema.
3. Use the SciMiner extraction workflow:
   - `/extract <path> [schema]`
   - `document-ingestion` when PDF parsing is needed first
   - `schema-creator` when no suitable schema exists
4. Report intermediate steps, tool calls, and output artifact paths in the session.

## Supported commands

- `/extract <path> [schema]`
- `/extract <path> [schema] --parallel N`
- `/schema-creator`
- `document-ingestion`

## Expected project directories

- `dataset/papers/` - source PDFs
- `schemas/` - extraction schemas
- `parsed_documents/` - cached parsed docs
- `extraction_outputs/` - extraction results

## Example schemas

- `fossil`
- `shale_gas`
- auto-judge when unspecified

## Outputs

SciMiner should produce outputs under:

- `extraction_outputs/<schema_name>/<doc_name>/output.csv`
- `extraction_outputs/<schema_name>/<doc_name>/extraction_plan.md`
- `extraction_outputs/<schema_name>/<doc_name>/decisions.md`

## PDF parsing dependencies

For MinerU/PDF parsing flows, install:

```bash
pip install paddleocr==2.8.1 paddlepaddle==2.6.2
```

## Local binding rule for this repo

When `data-extraction` mode is active in this project, always treat `sciminer` as the required local skill. Do not respond that the skill is missing if `scientific-skills/sciminer/SKILL.md` is present. Use the local skill behavior described here and keep all outputs inside the current workspace.
