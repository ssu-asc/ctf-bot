#!/usr/bin/env python3
"""CTF 알림 메인 스크립트.

K-CTF에서 국내 CTF 이벤트를 수집하고,
처음 발견한 대회를 시작일까지 기다리지 않고 Discord Webhook으로 전송합니다.

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
from urllib.parse import urlsplit

import httpx

import scrape_kctf
import state
from models import CTFEvent

KCTF_CACHE = Path(__file__).resolve().parent.parent / "data" / "kctf.json"

KST = timezone(timedelta(hours=9))

NEW_EVENT_ALERT = "new_event"


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

    return {
        "title": f"{emoji} {label}: {event.title}",
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
    except httpx.HTTPError:
        # 예외 문자열에는 비밀 Webhook URL이 포함될 수 있습니다.
        print("[Webhook] 전송 실패 (다음 실행에서 재시도)")
        return False


def announcement_id(event: CTFEvent) -> str:
    """제목이 수정되어도 동일한 K-CTF 게시물은 다시 알리지 않습니다."""
    path = urlsplit(event.url).path.rstrip("/")
    if path.startswith("/contests/"):
        return f"kctf-post-{path.rsplit('/', 1)[-1]}"
    return event.id


def main() -> int:
    webhook_url = get_webhook_url()
    now = datetime.now(tz=timezone.utc)
    test_mode = "--test" in sys.argv

    # 이벤트 수집 (K-CTF만)
    kctf_events = scrape_kctf.fetch()
    events: list[CTFEvent] = list(kctf_events)

    # K-CTF 결과를 캐시 파일에 저장 (/korean 커맨드용)
    _save_kctf_cache(kctf_events)

    if not events:
        print("수집된 이벤트 없음")
        return 0

    print(f"수집된 이벤트: {len(events)}개")

    # --test: 가장 가까운 이벤트 하나를 테스트 전송
    if test_mode:
        future = [e for e in events if e.start > now]
        future.sort(key=lambda e: e.start)
        if future:
            event = future[0]
            embed = build_embed(event, "\U0001f9ea", "테스트 알림")
            if not send_webhook(webhook_url, embed):
                return 1
            print(f"[TEST] 테스트 알림 전송: {event.title}")
        else:
            print("[TEST] 미래 이벤트 없음")
        return 0

    # 상태 로드
    notified = state.load()
    sent_count = 0
    failed_count = 0

    for event in events:
        if event.finish <= now or event.restrictions == "종료":
            continue

        event_key = announcement_id(event)
        if state.is_sent(notified, event_key, NEW_EVENT_ALERT):
            continue

        # 기존 시작일 알림으로 이미 소개한 대회는 재발송하지 않습니다.
        # 새 키로 이관하여 이후 제목 변경에도 중복을 막습니다.
        if notified.get(event.id, {}).get("sent"):
            state.mark_sent(notified, event_key, NEW_EVENT_ALERT)
            continue

        embed = build_embed(event, "\U0001f195", "새 대회 등록")
        if send_webhook(webhook_url, embed):
            state.mark_sent(notified, event_key, NEW_EVENT_ALERT)
            state.save(notified)
            sent_count += 1
            print(f"[SENT] 새 대회 등록: {event.title}")
        else:
            failed_count += 1

    # 상태 저장
    state.save(notified)

    # 등록 알림 이력은 유지합니다. 삭제하면 오래된 게시물을 다시 알리게 됩니다.
    print(f"전송 완료: {sent_count}건, 실패: {failed_count}건")
    return 1 if failed_count else 0


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


if __name__ == "__main__":
    sys.exit(main())
