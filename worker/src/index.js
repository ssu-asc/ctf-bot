/**
 * CTF Bot - Cloudflare Worker 엔트리포인트.
 *
 * Discord Interaction을 수신하여 슬래시 커맨드를 처리합니다.
 */

import { verifyDiscordRequest } from "./verify.js";
import { handleNewCtf } from "./commands/newctf.js";
import { handleChall } from "./commands/chall.js";
import { handleSolve } from "./commands/solve.js";
import { handleUpcoming } from "./commands/upcoming.js";
import { handleKorean } from "./commands/korean.js";
import { handleEndCtf } from "./commands/endctf.js";

export default {
  async fetch(request, env) {
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

      switch (name) {
        case "newctf":
          return handleNewCtf(interaction, env);
        case "chall":
          return handleChall(interaction, env);
        case "solve":
          return handleSolve(interaction, env, true);
        case "unsolve":
          return handleSolve(interaction, env, false);
        case "upcoming":
          return handleUpcoming(interaction);
        case "korean":
          return handleKorean();
        case "endctf":
          return handleEndCtf(interaction, env);
        default:
          return new Response(
            JSON.stringify({
              type: 4,
              data: { content: `\u2753 알 수 없는 커맨드: /${name}`, flags: 64 },
            }),
            { headers: { "Content-Type": "application/json" } }
          );
      }
    }

    return new Response("Unknown interaction type", { status: 400 });
  },
};
