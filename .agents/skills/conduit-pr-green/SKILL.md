---
name: conduit-pr-green
description: "Conduit repo PR creation and green-check workflow. Use when Codex needs to create, update, or finalize a GitHub pull request for this repository, especially when the user asks to create a PR, make it green, wait for checks, or clean up PR formatting."
---

# Conduit PR Green

Use this skill to create or update a Conduit PR and stop only when GitHub reports every PR check as completed and green.

## Hard Rules

- Use `rtk` before every shell command.
- Create ready-for-review PRs; do not create drafts unless the user explicitly asks.
- Do not let `gh pr checks --watch` be the final authority. Re-read `statusCheckRollup` after it exits, because `gh` can return success while checks are still pending.
- Treat `PENDING`, `QUEUED`, `IN_PROGRESS`, `FAILURE`, `CANCELLED`, `TIMED_OUT`, and `ACTION_REQUIRED` as not green.
- If the PR is `DIRTY`, rebase or merge the latest base branch, rerun validation, push, and continue polling.
- Do not stop until the PR is merge-clean and each check run is completed with `SUCCESS`, or until an external blocker makes that impossible.

## Workflow

1. Inspect state with `rtk git status --short --branch`, `rtk git branch --show-current`, and `rtk gh pr view --json number,url,mergeStateStatus,statusCheckRollup` if a PR may already exist.
2. Ensure the branch has cohesive commits and a clean worktree before creating or updating a PR.
3. Run the repo validation expected for the change, defaulting to `rtk pnpm run check` when the change touches normal Conduit code.
4. Push the branch with `rtk git push -u origin HEAD`, or `rtk git push --force-with-lease` only after an intentional rebase.
5. Create or update the PR with `gh`, using an explicit title and body file instead of raw `--fill` when formatting matters.
6. Poll GitHub checks continuously: run `rtk gh pr checks <number> --watch --interval 10`, then verify with `rtk gh pr view <number> --json mergeStateStatus,statusCheckRollup`.
7. If anything is pending, sleep and recheck. If anything fails, inspect the failing job, fix it, validate locally, commit, push, and restart the polling loop.

## PR Formatting

Use compact Markdown that renders cleanly in GitHub. Keep titles specific and sentence case, for example `Initialize Electron and Expo shells`.

Prefer this body shape:

```markdown
## Summary

- Briefly state what changed.
- Mention any important scope boundary.

## Verification

- `rtk pnpm run check`

## Notes

- Include only real caveats, screenshots, or runtime proof. Omit this section if empty.
```

Do not paste terminal walls, nested bullet trees, raw planning notes, or "AI-style" recap sections into the PR body. If there are runtime screenshots or proof artifacts, link or name them in one short note.
