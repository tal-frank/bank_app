---
name: update
description: Refresh the bank app's progress tracker so the next session can resume. Rewrites the "Now" block in .claude/progress.md from the conversation and git state, updates phase statuses, and appends a log line. Use at the end of a work session or when the user runs /update.
argument-hint: "[optional note to include]"
disable-model-invocation: true
allowed-tools: Read, Edit, Bash(git status:*), Bash(git log:*), Bash(git diff:*), Bash(git branch:*), Bash(git rev-list:*), Bash(date:*)
---

# /update: save the project's current state

Goal: a fresh session that reads only `.claude/progress.md` knows exactly where the
project stands and what to do next. Be factual: write only what this conversation
or git shows. Never guess.

Paths below are relative to the bank app root (the folder holding `.claude/`).
Git commands run against the repo that contains it.

## 1. Gather facts
- `date +%F`, `git branch --show-current`, `git log --oneline -5 -- .`,
  `git status --short -- .`, `git rev-list --left-right --count main...HEAD`.
- Read `.claude/progress.md` and `.claude/roadmap.md`.
- From this conversation: what was built or changed, what was tested (and what was
  not), decisions made, what the user said they'll do, and the agreed next step.
- If the user passed a note (`$ARGUMENTS`), include it.

## 2. Rewrite the Now block
Replace everything between `<!-- NOW:START ... -->` and `<!-- NOW:END -->` in
`.claude/progress.md` (keep both marker lines). Use exactly these bullets, max ~20 lines:

```
## Now
- **Updated:** YYYY-MM-DD
- **Where we are:** current phase and step, one line.
- **Git:** branch; last commit; what is uncommitted (group by folder); ahead/behind main.
- **Next step:** one concrete action for the next session.
- **Waiting on the user:** decisions or tasks only the user can do (or "nothing").
- **Not verified:** what was built but not tested, or tested only partly (or "nothing").
- **Watch out:** anything the next session would otherwise trip on (or omit the bullet).
```

## 3. Update the rest of progress.md
- Phase table: set statuses (✅ done, committed / ✅ done, uncommitted / 🔄 in progress / ⬜).
- Detail checklist for the current phase: tick finished steps; add the next phase's
  steps when a new phase starts.
- Log: append one line, `- YYYY-MM-DD: <what got done this session>`. Never edit old lines.

## 4. Only if something durable changed
- New convention, decision or gotcha → update `.claude/CLAUDE.md` (keep it short).
- Phase design changed → update that row of `.claude/roadmap.md`.
- Otherwise leave both files alone.

## Rules
- Don't commit, push or stage anything.
- Never read or print `server/.env` values.
- Reply to the user in 2–3 short lines: what changed in the tracker and the next step.
