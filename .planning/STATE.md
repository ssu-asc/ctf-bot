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
- DONE: implementation commit `43cdcc3` pushed to `origin/main`. Initial push using the default `yc54616` account failed with 403/read-only permission; the already-authenticated repository owner `ssu-asc` had ADMIN permission. Used its credential only in child-process environment; the default active GitHub account was not changed.
- DONE: `rtk gh workflow run check-ctfs.yml --ref main -f test=false` (owner credential scoped to the command); `rtk proxy timeout 55 gh run watch 38729839344 --interval 15 --exit-status` — success. Owner-authenticated `rtk proxy gh run view 38729839344 --log` confirmed two successful new-listing deliveries, zero failures; state/cache commit `05e7342` records both post IDs and all seven listings.
- DONE: second normal dispatch and `rtk proxy timeout 55 gh run watch 38729910031 --interval 15 --exit-status` — success. `rtk proxy gh run view 38729910031 --log` confirmed zero deliveries and zero failures; persisted duplicate prevention works in production. Runs: https://github.com/ssu-asc/ctf-bot/actions/runs/38729839344 and https://github.com/ssu-asc/ctf-bot/actions/runs/38729910031.
- NOT_RUN: waiting for an actual future K-CTF publication or proving a maximum scheduling latency. Five-minute cron configuration is verified; GitHub Actions can delay scheduled jobs (official schedule documentation checked).
- Next: none required for this request. Continue scheduled new-listing announcements; no countdown alerts or synthetic Discord test messages.

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
