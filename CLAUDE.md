# More'Wax — Claude Code Instructions

## How to write CHANGES files

Every PR must include a dated change file in `CHANGES/`.

### File naming

`CHANGES/YYYY-MM-DD_<conventional-commit-slug>.md`

Example: `CHANGES/2026-03-15_feat-detail-pager.md`

### Template

```markdown
# <conventional commit title>

**Date:** YYYY-MM-DD
**Branch:** <branch name>
**Type:** Feature | Fix | Refactor | ...

## Intent

One paragraph describing the motivation and goal.

### Prompts summary

Numbered list of paraphrased user prompts — fix typos, rephrase for clarity, never use direct quotes.

## Changes

### `path/to/file`

Describe what was changed and why, at the level of functions/sections affected.

(Repeat for each file.)

## <optional sections>

Add extra sections as needed (e.g., "Rate limit mitigation", "Interaction model", "Migration notes").
```

### Rules

- **Exhaustive**: cover every file changed with enough detail to understand the diff without reading it.
- **Prompts summary**: always paraphrase — fix typos and rephrase for clarity, never paste raw user messages.
- **One file per PR**: each PR gets exactly one CHANGES file.
