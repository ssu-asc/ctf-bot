/**
 * /korean - 국내 CTF 대회 목록을 조회합니다.
 */

const KCTF_URL = "https://k-ctf.org";

export async function handleKorean() {
  let html;
  try {
    const resp = await fetch(KCTF_URL, {
      headers: { "User-Agent": "ASC-CTF-Bot/1.0" },
      redirect: "follow",
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    html = await resp.text();
  } catch (e) {
    return ephemeralReply(`\u26a0\ufe0f K-CTF 조회 실패: ${e.message}`);
  }

  // 간단한 HTML 파싱 (Worker에서 DOM parser 사용 불가하므로 정규식)
  const events = parseKctfHtml(html);

  if (events.length === 0) {
    return reply("\U0001f1f0\U0001f1f7 현재 예정된 국내 CTF가 없습니다.");
  }

  const lines = events.slice(0, 15).map(
    (e, i) => `**${i + 1}.** [${e.title}](${e.url})\n   \U0001f4c5 ${e.date}`
  );

  return reply(
    `\U0001f1f0\U0001f1f7 **국내 CTF 대회 목록**\n\n${lines.join("\n\n")}`
  );
}

function parseKctfHtml(html) {
  const events = [];
  // 테이블 행에서 제목과 날짜 추출
  const rowPattern =
    /<tr[^>]*>[\s\S]*?<td[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/gi;
  let match;
  while ((match = rowPattern.exec(html)) !== null) {
    const url = match[1].startsWith("http")
      ? match[1]
      : KCTF_URL + match[1];
    const title = match[2].replace(/<[^>]*>/g, "").trim();
    const date = match[3].replace(/<[^>]*>/g, "").trim();
    if (title && date) {
      events.push({ title, url, date });
    }
  }
  return events;
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
