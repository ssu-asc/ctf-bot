---
status: in-progress
---

# Automatic project interest rooms

1. Add a Durable Object coordinator and one-minute Cron trigger to the existing Worker. Limit processing per run, honor Discord rate limits, and keep all external interaction signature checks.
2. For the six configured reactions, lazily create a zero-permission role and private text room. Persist their IDs and managed member IDs; recover ambiguous creation without duplicating resources. Existing CTF functions and GitHub schedules stay unchanged.
3. Grant/revoke only these six roles from eligible participants. Multiple fields are independent. Do not delete channels, messages, or roles. Stop on missing stored resources rather than undoing an administrator's manual deletion.
4. Run meaningful Node tests and Wrangler dry-run, commit the scoped change, deploy with the existing ASC profile/secrets, and verify live rooms and permissions.

Implementation runs inline. Initial repository was clean. No user token or browser credentials are used by the bot.
