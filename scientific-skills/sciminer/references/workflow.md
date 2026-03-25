# SciMiner Local Workflow Reference

## Default extraction flow

1. User uploads one or more PDF files into the current session workspace.
2. Data-extraction mode is active.
3. If the user names a schema, prefer it.
4. Otherwise auto-judge the most suitable schema.
5. Run extraction with `/extract <path> [schema]` semantics.
6. Keep progress visible in the conversation.
7. Write outputs under `extraction_outputs/`.

## Output artifacts

- `output.csv`
- `extraction_plan.md`
- `decisions.md`

## Example schemas

- `fossil`
- `shale_gas`
