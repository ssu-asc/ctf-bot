/**
 * CTF Bot - Cloudflare Worker 엔트리포인트.
 *
 * Discord Interaction을 수신하여 슬래시 커맨드를 처리합니다.
 * 무거운 커맨드는 deferred response (type 5) + followup 패턴 사용.
 */

import { verifyDiscordRequest } from "./verify.js";
import { handleNewCtf } from "./commands/newctf.js";
import { handleChall } from "./commands/chall.js";
import { handleSolve } from "./commands/solve.js";
import { handleUpcoming } from "./commands/upcoming.js";
import { handleKorean } from "./commands/korean.js";
import { handleEndCtf } from "./commands/endctf.js";

const DISCORD_API = "https://discord.com/api/v10";

/** Deferred 응답이 필요한 무거운 커맨드 */
const DEFERRED_COMMANDS = new Set(["newctf", "endctf", "chall", "solve", "unsolve"]);

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // Ed25519 시그니처 검증
    const { isValid, body } = await verifyDiscordRequest(
      request,
      env.DISCORD_PUBLIC_KEY
    );
    if (!isValid) {
      return new Response("Invalid request signature", { status: 401 });
    }

    const interaction = JSON.parse(body);

    // PING → PONG (Discord 검증용)
    if (interaction.type === 1) {
      return new Response(JSON.stringify({ type: 1 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // APPLICATION_COMMAND (type 2)
    if (interaction.type === 2) {
      const name = interaction.data.name;

      // 가벼운 커맨드: 즉시 응답
      if (!DEFERRED_COMMANDS.has(name)) {
        switch (name) {
          case "upcoming":
            return handleUpcoming(interaction);
          case "korean":
            return handleKorean();
          default:
            return jsonResponse({
              type: 4,
              data: { content: `\u2753 알 수 없는 커맨드: /${name}`, flags: 64 },
            });
        }
      }

      // 무거운 커맨드: deferred 응답 후 백그라운드에서 처리
      const appId = env.DISCORD_APPLICATION_ID;
      const token = interaction.token;

      ctx.waitUntil(
        runDeferred(name, interaction, env, appId, token)
      );

      // 즉시 "처리 중..." 응답 (type 5 = DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE)
      return jsonResponse({ type: 5 });
    }

    return new Response("Unknown interaction type", { status: 400 });
  },
};

/**
 * Deferred 커맨드를 백그라운드에서 실행하고 followup 메시지로 결과 전송.
 */
async function runDeferred(name, interaction, env, appId, token) {
  let content;
  try {
    switch (name) {
      case "newctf":
        content = await handleNewCtf(interaction, env);
        break;
      case "chall":
        content = await handleChall(interaction, env);
        break;
      case "solve":
        content = await handleSolve(interaction, env, true);
        break;
      case "unsolve":
        content = await handleSolve(interaction, env, false);
        break;
      case "endctf":
        content = await handleEndCtf(interaction, env);
        break;
      default:
        content = `\u2753 알 수 없는 커맨드: /${name}`;
    }
  } catch (e) {
    content = `\u26a0\ufe0f 오류 발생: ${e.message}`;
  }

  // Followup 메시지 전송
  await fetch(`${DISCORD_API}/webhooks/${appId}/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

function jsonResponse(data) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
}
