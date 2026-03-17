"""CTF 이벤트 데이터 모델."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class CTFEvent:
    """CTF 대회 이벤트."""

    id: str
    title: str
    start: datetime
    finish: datetime
    url: str
    format: str = "Jeopardy"
    weight: float = 0.0
    source: str = "ctftime"
    reg_start: datetime | None = None
    logo_url: str = ""
    restrictions: str = ""

    @property
    def duration_hours(self) -> float:
        return (self.finish - self.start).total_seconds() / 3600

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "start": self.start.isoformat(),
            "finish": self.finish.isoformat(),
            "url": self.url,
            "format": self.format,
            "weight": self.weight,
            "source": self.source,
        }
