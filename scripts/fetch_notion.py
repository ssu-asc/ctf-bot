#!/usr/bin/env python3
"""Notion 캘린더 DB에서 일정을 가져옵니다.

Environment:
    NOTION_TOKEN - Notion Integration 토큰
    NOTION_DATABASE_ID - 캘린더 데이터베이스 ID
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date, datetime

import httpx

NOTION_API = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"


@dataclass
class ScheduleEvent:
    id: str
    title: str
    start: date
    end: date | None
    tag: str

    @property
    def date_display(self) -> str:
        s = self.start.strftime("%m/%d")
        if self.end and self.end != self.start:
            return f"{s} ~ {self.end.strftime('%m/%d')}"
        return s


def _parse_date(s: str) -> date:
    """'2026-03-30' 또는 '2026-03-30T09:00:00' 형식을 date로 변환."""
    return datetime.fromisoformat(s).date() if "T" in s else date.fromisoformat(s)


def fetch() -> list[ScheduleEvent]:
    """Notion DB에서 일정을 가져옵니다."""
    token = os.environ.get("NOTION_TOKEN", "")
    db_id = os.environ.get("NOTION_DATABASE_ID", "")
    if not token or not db_id:
        print("[Notion] NOTION_TOKEN 또는 NOTION_DATABASE_ID 미설정")
        return []

    headers = {
        "Authorization": f"Bearer {token}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }

    events: list[ScheduleEvent] = []
    has_more = True
    start_cursor = None

    try:
        while has_more:
            body: dict = {}
            if start_cursor:
                body["start_cursor"] = start_cursor

            resp = httpx.post(
                f"{NOTION_API}/databases/{db_id}/query",
                headers=headers,
                json=body,
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()

            for page in data.get("results", []):
                props = page["properties"]

                # 이름
                title_arr = props.get("이름", {}).get("title", [])
                title = title_arr[0]["text"]["content"] if title_arr else ""

                # 날짜
                date_prop = props.get("날짜", {}).get("date")
                if not date_prop or not date_prop.get("start"):
                    continue
                start = _parse_date(date_prop["start"])
                end_raw = date_prop.get("end")
                end = _parse_date(end_raw) if end_raw else None

                # 태그
                tag_arr = props.get("태그", {}).get("rich_text", [])
                tag = tag_arr[0]["text"]["content"] if tag_arr else ""

                events.append(
                    ScheduleEvent(
                        id=page["id"],
                        title=title,
                        start=start,
                        end=end,
                        tag=tag,
                    )
                )

            has_more = data.get("has_more", False)
            start_cursor = data.get("next_cursor")

    except httpx.HTTPError as e:
        print(f"[Notion] API 오류: {e}")

    events.sort(key=lambda e: e.start)
    print(f"[Notion] {len(events)}개 일정 로드")
    return events
