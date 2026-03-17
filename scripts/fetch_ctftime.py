"""CTFtime.org API에서 CTF 이벤트를 가져옵니다."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import httpx

from models import CTFEvent

CTFTIME_API = "https://ctftime.org/api/v1/events/"
USER_AGENT = "ASC-CTF-Bot/1.0"


def fetch(days: int = 30) -> list[CTFEvent]:
    """향후 days일간의 CTF 이벤트를 가져옵니다."""
    now = datetime.now(tz=timezone.utc)
    params = {
        "limit": 100,
        "start": int(now.timestamp()),
        "finish": int((now + timedelta(days=days)).timestamp()),
    }
    headers = {"User-Agent": USER_AGENT}

    try:
        resp = httpx.get(CTFTIME_API, params=params, headers=headers, timeout=30)
        resp.raise_for_status()
    except httpx.HTTPError as e:
        print(f"[CTFtime] API 요청 실패: {e}")
        return []

    events = []
    for item in resp.json():
        try:
            start = datetime.fromisoformat(item["start"].replace("T", "T"))
            finish = datetime.fromisoformat(item["finish"].replace("T", "T"))
            events.append(CTFEvent(
                id=f"ctftime-{item['id']}",
                title=item.get("title", ""),
                start=start,
                finish=finish,
                url=item.get("ctftime_url", item.get("url", "")),
                format=item.get("format", "Jeopardy"),
                weight=item.get("weight", 0.0),
                source="ctftime",
                logo_url=item.get("logo", ""),
                restrictions=item.get("restrictions", "Open"),
            ))
        except (KeyError, ValueError) as e:
            print(f"[CTFtime] 이벤트 파싱 실패: {e}")
            continue

    return events
