# State

## Current task — 2026-10-15 K-CTF new listing notifications

- User request: "이거 k-ctf 올라오면 바로 알림 떠야 할거 같은데", clarified "3일전이 아니라".
- DONE: replaced start-date countdown notifications with one announcement when an unannounced K-CTF listing is first detected; poll every five minutes. GitHub Actions scheduling can be delayed, so this is not a real-time guarantee.
- Preserve unrelated Worker/interest-room behavior and keep Notion notifications disabled. No intent contract exists; do not initialize a new planning workflow.
- Evidence: `scripts/notify.py` uses only start-date countdowns; `.github/workflows/check-ctfs.yml` polls hourly. GitHub lists only the active CTF workflow. Current K-CTF HTML has seven cards including a Whitehat listing absent from the latest cached six events.
- DONE: clean checkout fast-forwarded to `origin/main` (`ab6f0e6`); upstream differences were automated cache/state updates only.
- DONE: stable post-ID deduplication, legacy countdown-history migration, expired-event exclusion, persistent history, failure retries, serialized workflow runs, and state commit even after partial delivery failure. Existing upcoming listings without any notification history will be announced on the first run.
- DONE: `rtk test python3 -m unittest discover -s scripts -p 'test_*.py' -v` — 12 passed (the initial run reproduced 10 failures before the fix). `rtk npm test` from `worker/` — 15 passed. `rtk git diff --check` — exit 0. YAML parse/assertion command — PASS for five-minute schedule, concurrency, and partial-success persistence.
- DONE: live K-CTF read with `notify.main()` using temporary state/cache and mocked `send_webhook` — seven parsed listings; two proposed announcements (2026 Chungcheong Biohealth and 2026 Whitehat); no Discord requests and no production-state writes.
- IN_PROGRESS: commit/push and normal production workflow verification. No test messages are required.
- NOT_RUN: production delivery and post-delivery duplicate check.
- Next: deploy intended changes, run the normal workflow, and verify successful delivery/state persistence and no duplicate notification on another run.

## Previous task — 2026-09-23

Current work: 2026-09-23 AI interest room and requested announcement tone.
Approved: one room per field; multiple selections allowed; no channel/message deletion.
Complete: added AI with the 🤖 reaction as the seventh field. Fifteen automated checks pass, including lower-case AI channel recovery without duplicates and in-place copy migration. Deployed version 7f20dd51-9338-4c21-8772-2ef61aed4ada uses seven reactions and one shared channel per field. Copy version 3 follows the user's announcement example: descriptions use 합니다 and requests use 해주세요.
Live AI verification through Discord's UI confirmed the guide, reaction, automatic role grant, formal welcome, and private overwrites on channel 1552123275365187634. All original six rooms and reaction removal/rejoin were verified in the preceding task. Existing CTF workflows remain unchanged.
All seven current welcome messages were rechecked after copy version 3 deployment. Guide posts, two forum guidelines and Tickets v2 panel/form copy use the same requested tone; team building starts with field selection before topic discussion and team formation.

## Quick Tasks Completed

- 260923-2pd: Automatic interest rooms, scoped membership reconciliation, and formal welcome copy. Source commits dafd2c6 and 0e7c3b5 pushed to origin/main.
- 2026-09-23 AI follow-up: seventh field deployed and verified; evidence in /home/yc54616/outputs/asc-discord-restructure-20260922/ai-live-audit.json.
- 2026-09-23 announcement tone follow-up: tracked welcome messages updated in place; evidence in /home/yc54616/outputs/asc-discord-restructure-20260922/friendly-welcome-audit.json.
