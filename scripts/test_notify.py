"""K-CTF 신규 등록 알림 회귀 검사. 외부 요청/메시지를 보내지 않습니다."""

import json
import tempfile
import unittest
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import notify
import state
from models import CTFEvent


class NewListingNotificationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.now = datetime(2026, 10, 15, 9, tzinfo=timezone.utc)
        self.event = CTFEvent(
            id="kctf-test-contest",
            title="Test Contest",
            start=self.now + timedelta(days=22),
            finish=self.now + timedelta(days=23),
            url="http://k-ctf.org/contests/contest-1",
            source="kctf",
        )
        self.enterContext(patch.object(state, "STATE_FILE", root / "notified.json"))
        self.enterContext(patch.object(notify, "KCTF_CACHE", root / "kctf.json"))
        self.enterContext(patch.object(notify.sys, "argv", ["notify.py"]))
        self.enterContext(patch.object(notify, "get_webhook_url", return_value="https://example.invalid/webhook"))
        clock = self.enterContext(patch.object(notify, "datetime"))
        clock.now.return_value = self.now
        self.fetch = self.enterContext(patch.object(notify.scrape_kctf, "fetch", return_value=[self.event]))
        self.send = self.enterContext(patch.object(notify, "send_webhook", return_value=True))

    def test_new_listing_is_announced_weeks_before_start(self):
        self.assertEqual(notify.main(), 0)
        self.send.assert_called_once()
        self.assertIn("새 대회 등록", self.send.call_args.args[1]["title"])
        self.assertIn(self.event.url, self.send.call_args.args[1]["description"])
        self.assertEqual(json.loads(notify.KCTF_CACHE.read_text())["events"][0]["id"], self.event.id)

    def test_repeated_polls_and_countdown_dates_do_not_announce_again(self):
        self.assertEqual(notify.main(), 0)
        for remaining in (7, 3, 1, 0):
            with self.subTest(remaining=remaining):
                self.fetch.return_value = [replace(
                    self.event,
                    start=self.now + timedelta(days=remaining),
                    finish=self.now + timedelta(days=remaining + 1),
                )]
                self.assertEqual(notify.main(), 0)
        self.send.assert_called_once()

    def test_title_change_does_not_repeat_announcement(self):
        notify.main()
        self.fetch.return_value = [replace(self.event, id="kctf-renamed-contest", title="Renamed Contest")]
        notify.main()
        self.send.assert_called_once()

    def test_distinct_listings_with_same_title_are_both_announced(self):
        self.fetch.return_value = [self.event, replace(self.event, url="http://k-ctf.org/contests/contest-2")]
        self.assertEqual(notify.main(), 0)
        self.assertEqual(self.send.call_count, 2)

    def test_previously_announced_countdown_event_is_migrated_without_resending(self):
        state.save({self.event.id: {"sent": ["starts_3d"]}})
        self.assertEqual(notify.main(), 0)
        self.fetch.return_value = [replace(self.event, id="kctf-renamed-contest", title="Renamed Contest")]
        self.assertEqual(notify.main(), 0)
        self.send.assert_not_called()

    def test_finished_events_are_not_announced(self):
        self.fetch.return_value = [replace(
            self.event, start=self.now - timedelta(days=2), finish=self.now - timedelta(days=1)
        ), replace(self.event, restrictions="종료")]
        self.assertEqual(notify.main(), 0)
        self.send.assert_not_called()

    def test_failed_delivery_is_retried_even_after_cache_update(self):
        self.send.side_effect = [False, True]
        self.assertEqual(notify.main(), 1)
        self.assertEqual(notify.main(), 0)
        self.assertEqual(notify.main(), 0)
        self.assertEqual(self.send.call_count, 2)

    def test_partial_failure_retries_only_the_unsent_listing(self):
        self.fetch.return_value = [self.event, replace(
            self.event, id="kctf-second", title="Second Contest", url="http://k-ctf.org/contests/contest-2"
        )]
        self.send.side_effect = [True, False, True]
        self.assertEqual(notify.main(), 1)
        self.assertEqual(notify.main(), 0)
        self.assertEqual(self.send.call_count, 3)
        self.assertIn("Second Contest", self.send.call_args.args[1]["title"])

    def test_duplicate_cards_send_only_once(self):
        self.fetch.return_value = [self.event, self.event]
        self.assertEqual(notify.main(), 0)
        self.send.assert_called_once()

    def test_announcement_history_is_not_pruned_at_300_events(self):
        notify.main()
        notified = state.load()
        notified.update({f"older-{i}": {"sent": ["new_event"]} for i in range(301)})
        state.save(notified)
        notify.main()
        notify.main()
        self.send.assert_called_once()

    def test_test_mode_does_not_mark_the_listing_as_announced(self):
        with patch.object(notify.sys, "argv", ["notify.py", "--test"]):
            self.assertEqual(notify.main(), 0)
        self.assertEqual(state.load(), {})
        self.assertEqual(notify.main(), 0)
        self.assertEqual(self.send.call_count, 2)

    def test_test_mode_returns_failure_for_failed_delivery(self):
        self.send.return_value = False
        with patch.object(notify.sys, "argv", ["notify.py", "--test"]):
            self.assertEqual(notify.main(), 1)


if __name__ == "__main__":
    unittest.main()
