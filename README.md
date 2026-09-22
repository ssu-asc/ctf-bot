# CTF Bot

## 프로젝트 관심 분야 자동 입장

ASC의 `관심분야-선택` 메시지에서 🌐 웹 / 💥 포너블 / 🧩 리버싱 / 🔐 암호학 / 🔎 포렌식을 선택하거나 💡 기타를 선택하면 해당 분야의 비공개 채널에 참여합니다. 분야별로 하나의 방을 사용하며 인원수로 나누지 않습니다. 여러 분야 선택도 가능합니다.

- Worker Cron이 약 1분마다 반응을 확인합니다. Discord 요청 제한이나 처리량에 따라 반영이 늦어질 수 있습니다.
- `2026-2 관심 · 분야명` 역할은 서버 권한이 없는 역할입니다. 해당 분야 채널만 열어줍니다.
- 새 참여자는 Active / Professor / Admin / Operation 역할이 있는 서버 멤버로 제한합니다.
- 반응을 취소하거나 참여 자격이 없어지면 봇이 부여한 분야 역할만 해제합니다. 채널, 메시지, 분야 역할 자체는 자동 삭제하지 않습니다.
- 운영진이 직접 부여한 역할은 자동화가 가져와 관리하지 않습니다. 자동화가 이미 관리 중인 멤버에게 직접 같은 역할을 부여하는 것은 별도 수동 예외가 되지 않습니다.
- 소유한 역할이나 채널을 운영진이 삭제하거나 권한을 변경하면 자동 재생성/덮어쓰기하지 않고 해당 실행을 실패시킵니다. 원인을 확인한 뒤 복구해주세요.
- Durable Object가 중복 실행을 막고 역할·채널 ID와 관리하는 회원 ID를 보관합니다. 메시지 내용이나 회원 프로필은 저장하지 않습니다.
- 설정은 `worker/src/interests.js`, 정지는 `worker/wrangler.toml`의 `INTEREST_ROOMS_ENABLED = "false"` 후 배포로 처리합니다. 기존 CTF 명령과 GitHub 알림은 별도입니다.

검증: `cd worker` 후 `npm test`, `wrangler deploy --dry-run`. 배포에는 기존 `ssu-asc` Wrangler 프로필과 Worker의 bot secret을 사용합니다.

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

`DISCORD_BOT_TOKEN`은 Discord Developer Portal의 Bot Token 값만 입력하세요.
`Bot ` 접두어, Client Secret, Public Key, Webhook URL을 넣으면 Discord API 인증에 실패합니다.

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
