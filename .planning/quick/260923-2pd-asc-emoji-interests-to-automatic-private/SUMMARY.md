# Automatic project interest rooms — complete

The approved ASC intake message now controls six field roles and private text channels. Everyone who selects the same field joins its single shared channel; multiple selections are independent. Members form teams inside these channels. The bot does not divide participants into fixed-size teams.

## Validation

- `rtk proxy npm test`: 14/14 checks passed, including concurrency, pagination, rate limits, grant recovery, manual roles, permission changes, signature validation, and idempotent copy migration.
- Wrangler dry-run passed; deployed version `ac373229-8416-4be8-bb1a-02a958c1673d` uses the existing ASC account and secrets.
- UI verified all six channels and formal welcome messages. Each channel denies @everyone view, grants its field role and Operation view, and has no broad Active/Member overwrite.
- On the administrator's own seeded reaction, removing 기타 revoked only that field role. Selecting it again restored it. All six field roles and channels remained available after the test. This verifies role synchronization; no separate non-administrator account was impersonated or used.
- Existing channel IDs, welcome message IDs and conversation histories are retained. No channel/message/role deletion is implemented.
- Existing slash commands and separate GitHub notification schedules remain unchanged.

## Deployment and operations

Commits `dafd2c6` and `0e7c3b5` are on origin/main. Processing normally occurs on the next one-minute cron; larger batches and rate limits defer remaining work safely. The Durable Object serializes updates. The bot stores only provisioning IDs and its managed member IDs.

Manually changing a generated channel's privacy or deleting a stored resource stops reconciliation rather than recreating it silently. Generated welcome copy is versioned and edited in place; manually edited channel topics are preserved.

Live UI evidence resides in the local task artifact directory `outputs/asc-discord-restructure-20260922/`, including `final-interest-audit.json` and `interest-live-unselect.json`. These artifacts are not committed to the repository because they include local server details.
