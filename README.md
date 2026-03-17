# CTF Bot

ASC 동아리 CTF 알림 + 협업 디스코드 봇.

- **자동 알림**: GitHub Actions가 매시간 CTFtime.org + K-CTF.org를 확인하여 Discord Webhook으로 알림
- **협업 기능**: Cloudflare Workers가 슬래시 커맨드를 처리하여 CTF별 포럼 채널 생성/관리

## 아키텍처

```
GitHub Actions (cron 매시간) → CTFtime/K-CTF 확인 → Discord Webhook 알림
Cloudflare Workers → Discord Interaction 처리 → 포럼 채널/쓰레드 관리
```

비용: 전부 무료 (GitHub Actions public repo + Cloudflare Workers free tier)

## 슬래시 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/newctf <name>` | 새 CTF 시작 - 포럼 채널 + 음성 채널 생성 |
| `/chall <name> [category]` | 문제 등록 - 포럼에 포스트 생성 |
| `/solve [name]` | 문제 풀이 완료 |
| `/unsolve [name]` | 풀이 취소 |
| `/upcoming [days]` | 다가오는 CTF 목록 (CTFtime) |
| `/korean` | 국내 CTF 목록 (K-CTF) |
| `/endctf <name>` | CTF 종료 + 아카이브 |

## 설정

### GitHub Secrets

| 시크릿 | 용도 |
|--------|------|
| `DISCORD_WEBHOOK_URL` | 알림 채널 Webhook URL |

### Cloudflare Worker 환경변수

```bash
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put DISCORD_BOT_TOKEN
wrangler secret put DISCORD_APPLICATION_ID
```

### KV Namespace 생성

```bash
cd worker
wrangler kv namespace create CTF_STATE
# 출력된 id를 wrangler.toml에 입력
```

### 슬래시 커맨드 등록 (1회)

```bash
DISCORD_APPLICATION_ID=... DISCORD_BOT_TOKEN=... python scripts/register_commands.py
```

### Discord Bot 설정

1. [Discord Developer Portal](https://discord.com/developers/applications)에서 Application 생성
2. Bot 탭 → permissions: `Manage Channels`, `Send Messages`, `Use Slash Commands`
3. General Information → Interactions Endpoint URL → Cloudflare Worker URL 입력

## 배포

```bash
# Worker 배포
cd worker
npm install
wrangler deploy

# 알림은 GitHub Actions가 자동 실행 (매시간)
# 수동 테스트: Actions 탭 → workflow_dispatch
```
