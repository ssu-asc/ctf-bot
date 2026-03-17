/**
 * /upcoming [days=7] - 다가오는 CTF 대회 목록을 조회합니다.
 */

const CTFTIME_API = "https://ctftime.org/api/v1/events/";

export async function handleUpcoming(interaction) {
  const daysOpt = interaction.data.options?.find((o) => o.name === "days");
  const days = daysOpt?.value || 7;

  const now = Math.floor(Date.now() / 1000);
  const finish = now + days * 86400;

  let events;
  try {
    const resp = await fetch(
      `${CTFTIME_API}?limit=20&start=${now}&finish=${finish}`,
      { headers: { "User-Agent": "ASC-CTF-Bot/1.0" } }
    );
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    events = await resp.json();
  } catch (e) {
    return ephemeralReply(`\u26a0\ufe0f CTFtime API 조회 실패: ${e.message}`);
  }

  if (!events || events.length === 0) {
    return reply(`\u{1f4c5} 향후 ${days}일간 예정된 CTF가 없습니다.`);
  }

  const embeds = events.slice(0, 10).map((event) => {
    const start = new Date(event.start);
    const finish = new Date(event.finish);
    const startKST = formatKST(start);
    const finishKST = formatKST(finish);

    return {
      title: event.title,
      url: event.ctftime_url || event.url,
      description: [
        `\u{1f4c5} ${startKST} ~ ${finishKST} KST`,
        `\u{1f3ae} ${event.format || "N/A"}${event.weight ? `  \u2696\ufe0f ${event.weight.toFixed(2)}` : ""}`,
        event.restrictions ? `\u{1f512} ${event.restrictions}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      color: 0x5865f2,
      thumbnail: event.logo ? { url: event.logo } : undefined,
    };
  });

  return new Response(
    JSON.stringify({
      type: 4,
      data: {
        content: `\u{1f4c5} **향후 ${days}일간 예정된 CTF** (${events.length}개)`,
        embeds,
      },
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

function formatKST(date) {
  return date.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
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
