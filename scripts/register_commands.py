#!/usr/bin/env python3
"""Discord 슬래시 커맨드를 등록하는 스크립트 (1회 실행).

Usage:
    DISCORD_APPLICATION_ID=... DISCORD_BOT_TOKEN=... python scripts/register_commands.py

Environment:
    DISCORD_APPLICATION_ID - Discord Application ID
    DISCORD_BOT_TOKEN      - Discord Bot Token
"""

from __future__ import annotations

import os
import sys
import time

import httpx

DISCORD_API = "https://discord.com/api/v10"


def bot_authorization(token: str) -> str:
    token = token.strip()
    return token if token.lower().startswith("bot ") else f"Bot {token}"


COMMANDS = [
    {
        "name": "newctf",
        "description": "새 CTF를 시작하고 포럼 채널을 생성합니다",
        "options": [
            {
                "name": "name",
                "description": "CTF 이름 (예: DiceCTF-2026)",
                "type": 3,  # STRING
                "required": True,
            }
        ],
    },
    {
        "name": "chall",
        "description": "새 문제를 등록합니다",
        "options": [
            {
                "name": "name",
                "description": "문제 이름",
                "type": 3,
                "required": True,
            },
            {
                "name": "category",
                "description": "분야 (crypto, pwn, web, rev, misc 등)",
                "type": 3,
                "required": False,
            },
        ],
    },
    {
        "name": "solve",
        "description": "문제를 풀이 완료로 표시합니다",
        "options": [
            {
                "name": "name",
                "description": "문제 이름 (현재 문제 쓰레드 안이면 생략 가능)",
                "type": 3,
                "required": False,
            }
        ],
    },
    {
        "name": "unsolve",
        "description": "문제 풀이를 취소합니다",
        "options": [
            {
                "name": "name",
                "description": "문제 이름",
                "type": 3,
                "required": False,
            }
        ],
    },
    {
        "name": "upcoming",
        "description": "다가오는 CTF 대회 목록을 조회합니다",
        "options": [
            {
                "name": "days",
                "description": "조회할 일수 (기본: 7)",
                "type": 4,  # INTEGER
                "required": False,
            }
        ],
    },
    {
        "name": "korean",
        "description": "국내 CTF 대회 목록을 조회합니다",
    },
    {
        "name": "endctf",
        "description": "CTF를 종료하고 아카이브합니다",
        "options": [
            {
                "name": "name",
                "description": "CTF 이름",
                "type": 3,
                "required": True,
            }
        ],
    },
]


def main() -> int:
    app_id = os.environ.get("DISCORD_APPLICATION_ID")
    bot_token = os.environ.get("DISCORD_BOT_TOKEN")

    if not app_id or not bot_token:
        print("Error: DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN 환경변수를 설정하세요.")
        return 1

    url = f"{DISCORD_API}/applications/{app_id}/commands"
    headers = {"Authorization": bot_authorization(bot_token)}

    for cmd in COMMANDS:
        try:
            resp = httpx.post(url, json=cmd, headers=headers, timeout=15)
            # Rate limit 처리
            if resp.status_code == 429:
                retry_after = resp.json().get("retry_after", 2)
                print(f"[WAIT] Rate limited, {retry_after}s 대기...")
                time.sleep(retry_after + 0.5)
                resp = httpx.post(url, json=cmd, headers=headers, timeout=15)
            resp.raise_for_status()
            print(f"[OK] /{cmd['name']} 등록 완료")
            time.sleep(1)  # Rate limit 방지
        except httpx.HTTPError as e:
            print(f"[ERROR] /{cmd['name']} 등록 실패: {e}")
            if hasattr(e, "response") and e.response is not None:
                print(f"  응답: {e.response.text}")
            return 1

    print(f"\n전체 {len(COMMANDS)}개 커맨드 등록 완료!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
