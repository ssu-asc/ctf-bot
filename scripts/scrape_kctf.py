"""K-CTF.org에서 국내 CTF 이벤트를 스크래핑합니다."""

from __future__ import annotations

from datetime import datetime, timezone

import httpx
from bs4 import BeautifulSoup

from models import CTFEvent

KCTF_URL = "https://k-ctf.org"


def fetch() -> list[CTFEvent]:
    """K-CTF에서 예정된 CTF 이벤트를 가져옵니다."""
    try:
        resp = httpx.get(KCTF_URL, timeout=30, follow_redirects=True)
        resp.raise_for_status()
    except httpx.HTTPError as e:
        print(f"[K-CTF] 스크래핑 실패: {e}")
        return []

    try:
        return _parse_html(resp.text)
    except Exception as e:
        print(f"[K-CTF] 파싱 실패: {e}")
        return []


def _parse_html(html: str) -> list[CTFEvent]:
    """K-CTF HTML에서 이벤트를 추출합니다."""
    soup = BeautifulSoup(html, "html.parser")
    events = []

    # K-CTF는 테이블 형태로 대회 목록을 표시
    rows = soup.select("table tbody tr")
    if not rows:
        # 대체 셀렉터 시도
        rows = soup.select(".ctf-list .ctf-item, .event-list .event-item")

    for row in rows:
        try:
            cols = row.select("td")
            if len(cols) < 3:
                continue

            title = cols[0].get_text(strip=True)
            link_tag = cols[0].select_one("a")
            url = link_tag["href"] if link_tag else KCTF_URL
            if url.startswith("/"):
                url = KCTF_URL + url

            date_text = cols[1].get_text(strip=True)
            start, finish = _parse_date_range(date_text)
            if not start:
                continue

            event_id = f"kctf-{title.lower().replace(' ', '-')}"
            events.append(CTFEvent(
                id=event_id,
                title=title,
                start=start,
                finish=finish,
                url=url,
                source="kctf",
            ))
        except Exception:
            continue

    return events


def _parse_date_range(text: str) -> tuple[datetime | None, datetime | None]:
    """날짜 범위 텍스트를 파싱합니다."""
    # 여러 형식 시도: "2026-03-20 ~ 2026-03-22", "2026.03.20 - 2026.03.22" 등
    import re

    text = text.replace(".", "-").replace("/", "-")
    # "YYYY-MM-DD ~ YYYY-MM-DD" 또는 "YYYY-MM-DD HH:MM ~ YYYY-MM-DD HH:MM"
    pattern = r"(\d{4}-\d{2}-\d{2})\s*(?:\d{2}:\d{2})?\s*[~\-]\s*(\d{4}-\d{2}-\d{2})\s*(?:\d{2}:\d{2})?"
    match = re.search(pattern, text)
    if match:
        kst = timezone.utc  # 간소화: KST offset은 알림 로직에서 처리
        start = datetime.strptime(match.group(1), "%Y-%m-%d").replace(tzinfo=kst)
        finish = datetime.strptime(match.group(2), "%Y-%m-%d").replace(tzinfo=kst)
        return start, finish

    return None, None
