#!/usr/bin/env python3
"""CTF 알림 메인 스크립트.

두 소스(CTFtime, K-CTF)에서 이벤트를 수집하고,
알림 조건에 해당하는 이벤트를 Discord Webhook으로 전송합니다.

Usage:
    python scripts/notify.py

Environment:
    DISCORD_WEBHOOK_URL - Discord Webhook URL
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

import fetch_ctftime
import scrape_kctf
import state
from models import CTFEvent

KCTF_CACHE = Path(__file__).resolve().parent.parent / "data" / "kctf.json"

KST = timezone(timedelta(hours=9))

ALERT_CONFIG = [
    {
        "type": "starts_now",
        "emoji": "\U0001f680",
        "label": "대회 시작",
        "check": lambda e, now: e.start <= now <= e.start + timedelta(hours=1),
    },
    {
        "type": "starts_1h",
        "emoji": "\U0001f514",
        "label": "1시간 후 시작",
        "check": lambda e, now: timedelta(minutes=55) <= (e.start - now) <= timedelta(minutes=65),
    },
    {
        "type": "starts_tomorrow",
        "emoji": "\u23f0",
        "label": "내일 시작",
        "check": lambda e, now: timedelta(hours=23) <= (e.start - now) <= timedelta(hours=25),
    },
    {
        "type": "reg_open",
        "emoji": "\U0001f4cb",
        "label": "등록 시작",
        "check": lambda e, now: e.reg_start is not None and e.reg_start <= now and (now - e.reg_start) < timedelta(hours=1),
    },
]


def get_webhook_url() -> str:
    url = os.environ.get("DISCORD_WEBHOOK_URL")
    if not url:
        print("Error: DISCORD_WEBHOOK_URL 환경변수가 설정되지 않았습니다.")
        sys.exit(1)
    return url


def build_embed(event: CTFEvent, emoji: str, label: str) -> dict:
    """Discord Embed를 생성합니다."""
    start_kst = event.start.astimezone(KST).strftime("%Y-%m-%d %H:%M")
    finish_kst = event.finish.astimezone(KST).strftime("%m-%d %H:%M")

    description_parts = [
        f"\U0001f4c5 {start_kst} ~ {finish_kst} KST",
        f"\U0001f3ae {event.format}",
    ]
    if event.weight > 0:
        description_parts.append(f"\u2696\ufe0f {event.weight:.2f}")
    description_parts.append(f"\U0001f517 {event.url}")

    source_label = "[K-CTF]" if event.source == "kctf" else ""

    return {
        "title": f"{emoji} {label}: {event.title} {source_label}".strip(),
        "description": "\n".join(description_parts),
        "color": 0x00D166 if "시작" in label else 0xFEE75C,
        "thumbnail": {"url": event.logo_url} if event.logo_url else None,
    }


def send_webhook(webhook_url: str, embed: dict) -> bool:
    """Discord Webhook으로 Embed를 전송합니다."""
    # thumbnail이 None이면 제거
    if embed.get("thumbnail") is None:
        embed.pop("thumbnail", None)

    payload = {"embeds": [embed]}
    try:
        resp = httpx.post(webhook_url, json=payload, timeout=15)
        resp.raise_for_status()
        return True
    except httpx.HTTPError as e:
        print(f"[Webhook] 전송 실패: {e}")
        return False


def main() -> int:
    webhook_url = get_webhook_url()
    now = datetime.now(tz=timezone.utc)

    # 이벤트 수집
    events: list[CTFEvent] = []
    events.extend(fetch_ctftime.fetch())

    kctf_events = scrape_kctf.fetch()
    events.extend(kctf_events)

    # K-CTF 결과를 캐시 파일에 저장 (/korean 커맨드용)
    _save_kctf_cache(kctf_events)

    if not events:
        print("수집된 이벤트 없음")
        return 0

    print(f"수집된 이벤트: {len(events)}개")

    # 상태 로드
    notified = state.load()
    sent_count = 0

    for event in events:
        for alert in ALERT_CONFIG:
            if state.is_sent(notified, event.id, alert["type"]):
                continue
            if not alert["check"](event, now):
                continue

            embed = build_embed(event, alert["emoji"], alert["label"])
            if send_webhook(webhook_url, embed):
                state.mark_sent(notified, event.id, alert["type"])
                sent_count += 1
                print(f"[SENT] {alert['emoji']} {alert['label']}: {event.title}")

    # 상태 저장
    state.save(notified)

    # 오래된 항목 정리 (30일 이전)
    _cleanup_old_entries(notified, now)

    print(f"전송 완료: {sent_count}건")
    return 0


def _save_kctf_cache(events: list[CTFEvent]) -> None:
    """K-CTF 이벤트를 JSON 캐시 파일에 저장합니다."""
    data = {
        "updated_at": datetime.now(tz=timezone.utc).isoformat(),
        "events": [e.to_dict() for e in events],
    }
    KCTF_CACHE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"[K-CTF] 캐시 저장: {len(events)}개 이벤트")


def _cleanup_old_entries(notified: dict, now: datetime) -> None:
    """30일 이상 된 항목을 정리합니다."""
    # 간단히 300개 초과 시 앞쪽 항목 제거
    if len(notified) > 300:
        keys = list(notified.keys())
        for key in keys[:len(keys) - 200]:
            del notified[key]
        state.save(notified)


if __name__ == "__main__":
    sys.exit(main())
