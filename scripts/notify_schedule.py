#!/usr/bin/env python3
"""ASC 일정 알림 스크립트.

Notion 캘린더에서 일정을 가져와,
내일 시작하는 일정을 Discord 봇으로 전송합니다.

Usage:
    python scripts/notify_schedule.py
    python scripts/notify_schedule.py --test

Environment:
    NOTION_TOKEN - Notion Integration 토큰
    NOTION_DATABASE_ID - 캘린더 데이터베이스 ID
    DISCORD_BOT_TOKEN - Discord 봇 토큰
    DISCORD_SCHEDULE_CHANNEL_ID - 일정 알림 채널 ID
"""

from __future__ import annotations

import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path

import httpx

import fetch_notion

STATE_FILE = Path(__file__).resolve().parent.parent / "data" / "schedule_notified.json"


def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {}


def save_state(state: dict) -> None:
    STATE_FILE.write_text(
        json.dumps(state, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def build_embed(events: list[fetch_notion.ScheduleEvent], target_date: date) -> dict:
    """내일 시작하는 일정들을 하나의 Embed로 생성합니다."""
    weekday_kr = ["월", "화", "수", "목", "금", "토", "일"]
    date_str = target_date.strftime("%Y.%m.%d")
    day_name = weekday_kr[target_date.weekday()]

    lines = []
    for ev in events:
        period = ev.date_display
        lines.append(f"**{ev.title}**\n> {period}")

    return {
        "title": f"\U0001f4c5 내일의 ASC 일정 ({date_str} {day_name})",
        "description": "\n\n".join(lines),
        "color": 0x5865F2,
    }


def send_message(token: str, channel_id: str, embed: dict) -> bool:
    """Discord Bot API로 메시지를 전송합니다."""
    try:
        resp = httpx.post(
            f"https://discord.com/api/v10/channels/{channel_id}/messages",
            headers={"Authorization": f"Bot {token}"},
            json={"embeds": [embed]},
            timeout=15,
        )
        resp.raise_for_status()
        return True
    except httpx.HTTPError as e:
        print(f"[Discord] 전송 실패: {e}")
        return False


def main() -> int:
    bot_token = os.environ.get("DISCORD_BOT_TOKEN")
    channel_id = os.environ.get("DISCORD_SCHEDULE_CHANNEL_ID")
    if not bot_token or not channel_id:
        print("Error: DISCORD_BOT_TOKEN 또는 DISCORD_SCHEDULE_CHANNEL_ID가 설정되지 않았습니다.")
        return 1

    test_mode = "--test" in sys.argv
    today = date.today()
    tomorrow = today + timedelta(days=1)

    events = fetch_notion.fetch()
    if not events:
        print("일정 없음")
        return 0

    # 내일 시작하는 일정 필터링
    starting_tomorrow = [e for e in events if e.start == tomorrow]

    if test_mode:
        # 테스트: 가장 가까운 미래 일정 표시
        future = [e for e in events if e.start >= today]
        if future:
            test_events = [e for e in future if e.start == future[0].start]
            embed = build_embed(test_events, future[0].start)
            embed["title"] = "\U0001f9ea 테스트: " + embed["title"]
            send_message(bot_token, channel_id, embed)
            print(f"[TEST] {len(test_events)}개 일정 알림 전송")
        else:
            print("[TEST] 미래 일정 없음")
        return 0

    if not starting_tomorrow:
        print(f"내일({tomorrow}) 시작하는 일정 없음")
        return 0

    # 중복 체크
    state = load_state()
    date_key = tomorrow.isoformat()

    unsent = [e for e in starting_tomorrow if e.id not in state.get(date_key, [])]
    if not unsent:
        print(f"내일({tomorrow}) 일정 모두 전송 완료")
        return 0

    # 하나의 Embed로 묶어서 전송
    embed = build_embed(unsent, tomorrow)
    if send_message(bot_token, channel_id, embed):
        sent_ids = state.get(date_key, [])
        sent_ids.extend(e.id for e in unsent)
        state[date_key] = sent_ids
        save_state(state)
        print(f"[SENT] {len(unsent)}개 일정 알림 전송 ({tomorrow})")

    # 오래된 state 정리 (30일 이전)
    cutoff = (today - timedelta(days=30)).isoformat()
    old_keys = [k for k in state if k < cutoff]
    for k in old_keys:
        del state[k]
    if old_keys:
        save_state(state)

    return 0


if __name__ == "__main__":
    sys.exit(main())
