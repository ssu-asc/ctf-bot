/**
 * /solve [name] - 문제를 풀이 완료로 표시합니다.
 * /unsolve [name] - 풀이를 취소합니다.
 *
 * Returns: string (followup 메시지 내용)
 */

import { updateThreadTags } from "../discord.js";
import { findCtfByChannel, updateStatusMessage } from "./chall.js";

export async function handleSolve(interaction, env, isSolve = true) {
  const guildId = interaction.guild_id;
  const channelId = interaction.channel_id;
  const userId = interaction.member?.user?.id || interaction.user?.id;
  const token = env.DISCORD_BOT_TOKEN;
  const kv = env.CTF_STATE;

  const nameOpt = interaction.data.options?.find((o) => o.name === "name");
  const challName = nameOpt?.value;

  // CTF 찾기
  const ctfData = await findCtfByChannel(guildId, channelId, kv, token);
  if (!ctfData) {
    return "\u26a0\ufe0f CTF 채널에서 실행해주세요.";
  }

  const { key, state: ctfState } = ctfData;

  // 문제 찾기
  let challenge;
  if (challName) {
    challenge = ctfState.challenges.find(
      (c) => c.name.toLowerCase() === challName.toLowerCase()
    );
  } else {
    challenge = ctfState.challenges.find((c) => c.threadId === channelId);
  }

  if (!challenge) {
    return challName
      ? `\u26a0\ufe0f **${challName}** 문제를 찾을 수 없습니다.`
      : "\u26a0\ufe0f 문제 쓰레드에서 실행하거나, 문제 이름을 지정해주세요.";
  }

  if (isSolve) {
    if (challenge.solved) {
      return `\u2705 **${challenge.name}**은(는) 이미 풀이 완료입니다.`;
    }
    challenge.solved = true;
    challenge.solvedBy = userId;
  } else {
    if (!challenge.solved) {
      return `\u274c **${challenge.name}**은(는) 아직 미풀이 상태입니다.`;
    }
    challenge.solved = false;
    challenge.solvedBy = null;
  }

  // KV 업데이트
  await kv.put(key, JSON.stringify(ctfState));

  // 쓰레드 태그 변경
  const targetTag = isSolve ? "solved" : "unsolved";
  const tagId = ctfState.tagMap?.[targetTag];
  if (tagId && challenge.threadId) {
    try {
      await updateThreadTags(challenge.threadId, [tagId], token);
    } catch {
      // 태그 변경 실패해도 계속
    }
  }

  // 상태 메시지 갱신
  await updateStatusMessage(ctfState, token);

  const solved = ctfState.challenges.filter((c) => c.solved).length;
  const total = ctfState.challenges.length;
  const label = challenge.category
    ? `${challenge.category}/${challenge.name}`
    : challenge.name;

  if (isSolve) {
    return `\u{1f389} **${label}** 풀이 완료! (${solved}/${total} solved)`;
  } else {
    return `\u21a9\ufe0f **${label}** 풀이 취소 (${solved}/${total} solved)`;
  }
}
