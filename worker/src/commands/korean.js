/**
 * /korean - 국내 CTF 대회 목록을 조회합니다.
 *
 * GitHub Actions가 매시간 K-CTF를 스크래핑하여 data/kctf.json에 저장하고,
 * 이 커맨드는 해당 캐시 파일을 읽어서 응답합니다.
 */

const KCTF_CACHE_URL =
  "https://raw.githubusercontent.com/ssu-asc/ctf-bot/main/data/kctf.json";

export async function handleKorean() {
  let data;
  try {
    const resp = await fetch(KCTF_CACHE_URL, {
      headers: { "User-Agent": "ASC-CTF-Bot/1.0" },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    data = await resp.json();
  } catch (e) {
    return ephemeralReply(
      `\u26a0\ufe0f K-CTF 데이터 조회 실패: ${e.message}\nGitHub Actions가 아직 실행되지 않았을 수 있습니다.`
    );
  }

  const events = data.events || [];

  if (events.length === 0) {
    return reply(
      `\u{1f1f0}\u{1f1f7} 현재 예정된 국내 CTF가 없습니다.\n(마지막 업데이트: ${data.updated_at || "N/A"})`
    );
  }

  const lines = events.slice(0, 15).map((e, i) => {
    const title = e.title;
    const url = e.url;
    const start = e.start ? e.start.split("T")[0] : "";
    const finish = e.finish ? e.finish.split("T")[0] : "";
    return `**${i + 1}.** [${title}](${url})\n   \u{1f4c5} ${start} ~ ${finish}`;
  });

  return reply(
    `\u{1f1f0}\u{1f1f7} **국내 CTF 대회 목록**\n\n${lines.join("\n\n")}\n\n_마지막 업데이트: ${data.updated_at || "N/A"}_`
  );
}

function reply(content) {
  return new Response(
    JSON.stringify({ type: 4, data: { content } }),
    { headers: { "Content-Type": "application/json" } }
  );
}

function ephemeralReply(content) {
  return new Response(
    JSON.stringify({ type: 4, data: { content, flags: 64 } }),
    { headers: { "Content-Type": "application/json" } }
  );
}
