/**
 * /chall <name> [category] - 새 문제를 등록합니다.
 *
 * Returns: string (followup 메시지 내용)
 */

import { createForumPost, editMessage, getChannel } from "../discord.js";
import { buildStatusMessage } from "./newctf.js";

export async function handleChall(interaction, env) {
  const guildId = interaction.guild_id;
  const channelId = interaction.channel_id;
  const token = env.DISCORD_BOT_TOKEN;
  const kv = env.CTF_STATE;

  const challName = interaction.data.options.find(
    (o) => o.name === "name"
  ).value;
  const categoryOpt = interaction.data.options?.find(
    (o) => o.name === "category"
  );
  const category = categoryOpt?.value || "misc";

  // 현재 채널에서 CTF 찾기
  const ctfData = await findCtfByChannel(guildId, channelId, kv, token);
  if (!ctfData) {
    return "\u26a0\ufe0f CTF 포럼 채널에서 실행해주세요. (`/newctf`로 먼저 CTF를 만드세요)";
  }

  const { key, state: ctfState } = ctfData;

  // 중복 확인
  const existing = ctfState.challenges.find(
    (c) => c.name.toLowerCase() === challName.toLowerCase()
  );
  if (existing) {
    return `\u26a0\ufe0f **${challName}** 문제가 이미 등록되어 있습니다.`;
  }

  // 포럼에 새 포스트 생성
  const label = category ? `${category}/${challName}` : challName;
  const unsolvedTagId = ctfState.tagMap?.["unsolved"];

  const thread = await createForumPost(
    ctfState.forumChannelId,
    label,
    `**${label}** 문제 토론 공간입니다. 자유롭게 논의하세요!`,
    unsolvedTagId ? [unsolvedTagId] : [],
    token
  );

  // KV 업데이트
  ctfState.challenges.push({
    name: challName,
    category,
    threadId: thread.id,
    solved: false,
    solvedBy: null,
  });
  await kv.put(key, JSON.stringify(ctfState));

  // 상태 메시지 갱신
  await updateStatusMessage(ctfState, token);

  const total = ctfState.challenges.length;
  const solved = ctfState.challenges.filter((c) => c.solved).length;

  return `\u{1f4dd} **${label}** 등록! \u2192 <#${thread.id}>에서 토론하세요 (${solved}/${total} solved)`;
}

/**
 * 현재 채널 ID로부터 CTF를 찾습니다.
 */
async function findCtfByChannel(guildId, channelId, kv, token) {
  const prefix = `ctf:${guildId}:`;
  const keys = await kv.list({ prefix });

  for (const { name: key } of keys.keys) {
    const data = await kv.get(key, "json");
    if (!data || data.archived) continue;

    if (data.forumChannelId === channelId) {
      return { key, state: data };
    }
    if (data.generalThreadId === channelId) {
      return { key, state: data };
    }
    const challThread = data.challenges.find((c) => c.threadId === channelId);
    if (challThread) {
      return { key, state: data };
    }
  }

  // 쓰레드의 parent를 확인
  try {
    const channel = await getChannel(channelId, token);
    if (channel.parent_id) {
      return findCtfByChannel(guildId, channel.parent_id, kv, token);
    }
  } catch {
    // 무시
  }

  return null;
}

async function updateStatusMessage(ctfState, token) {
  if (!ctfState.generalThreadId || !ctfState.statusMessageId) return;

  const content = buildStatusMessage(ctfState.name, ctfState.challenges);
  try {
    await editMessage(
      ctfState.generalThreadId,
      ctfState.statusMessageId,
      content,
      token
    );
  } catch {
    // 상태 메시지 업데이트 실패해도 계속 진행
  }
}

export { findCtfByChannel, updateStatusMessage };
