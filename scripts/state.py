"""알림 전송 상태 관리 (notified.json)."""

from __future__ import annotations

import json
from pathlib import Path

STATE_FILE = Path(__file__).resolve().parent.parent / "data" / "notified.json"


def load() -> dict:
    """notified.json을 로드합니다. 없으면 빈 dict 반환."""
    if not STATE_FILE.exists():
        return {}
    return json.loads(STATE_FILE.read_text(encoding="utf-8"))


def save(state: dict) -> None:
    """notified.json에 상태를 저장합니다."""
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(
        json.dumps(state, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def is_sent(state: dict, event_id: str, alert_type: str) -> bool:
    """해당 이벤트+알림 타입이 이미 전송되었는지 확인합니다."""
    return alert_type in state.get(event_id, {}).get("sent", [])


def mark_sent(state: dict, event_id: str, alert_type: str) -> None:
    """알림 전송 완료를 기록합니다."""
    if event_id not in state:
        state[event_id] = {"sent": []}
    if alert_type not in state[event_id]["sent"]:
        state[event_id]["sent"].append(alert_type)
