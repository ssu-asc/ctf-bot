"""K-CTF.org에서 국내 CTF 이벤트를 스크래핑합니다."""

from __future__ import annotations

import re
from datetime import datetime, timezone, timedelta

import httpx
from bs4 import BeautifulSoup

from models import CTFEvent

KCTF_URL = "http://k-ctf.org"
KST = timezone(timedelta(hours=9))


def fetch() -> list[CTFEvent]:
    """K-CTF에서 CTF 이벤트를 가져옵니다."""
    try:
        resp = httpx.get(KCTF_URL, timeout=120, follow_redirects=True)
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

    cards = soup.select(".contest-card-list")
    for card in cards:
        try:
            # 제목
            title_tag = card.select_one("h3")
            if not title_tag:
                continue
            title = title_tag.get_text(strip=True)

            # URL (onclick="location.href='/contests/...'")
            onclick = card.get("onclick", "")
            url_match = re.search(r"location\.href='([^']+)'", onclick)
            url = KCTF_URL + url_match.group(1) if url_match else KCTF_URL

            # 주최
            organizer = ""
            org_tag = card.select_one("p.text-sm.text-gray-600")
            if org_tag:
                organizer = org_tag.get_text(strip=True)

            # 날짜 추출 (카드 텍스트에서)
            card_text = card.get_text()
            start = _extract_date(card_text)

            # 상태 (진행 예정 / 종료 등)
            status = ""
            for span in card.select("span"):
                text = span.get_text(strip=True)
                if text in ("진행 예정", "진행 중", "종료", "신청 중", "신청마감"):
                    status = text
                    break

            event_id = f"kctf-{title.lower().replace(' ', '-')}"
            finish = start + timedelta(days=1) if start else datetime.now(tz=KST)

            events.append(CTFEvent(
                id=event_id,
                title=title,
                start=start or datetime.now(tz=KST),
                finish=finish,
                url=url,
                source="kctf",
                restrictions=status,
                format=organizer,
            ))
        except Exception:
            continue

    return events


def _extract_date(text: str) -> datetime | None:
    """텍스트에서 날짜를 추출합니다."""
    # "2026.03.21" 형식
    match = re.search(r"(\d{4})\.(\d{2})\.(\d{2})", text)
    if match:
        return datetime(
            int(match.group(1)), int(match.group(2)), int(match.group(3)),
            tzinfo=KST,
        )
    return None
