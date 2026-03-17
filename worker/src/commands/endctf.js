/**
 * /endctf <name> - CTF를 종료하고 아카이브합니다.
 *
 * Returns: string (followup 메시지 내용)
 */

import {
  findCategory,
  createCategory,
  moveChannel,
  makeReadOnly,
} from "../discord.js";

export async function handleEndCtf(interaction, env) {
  const guildId = interaction.guild_id;
  const ctfName = interaction.data.options.find((o) => o.name === "name").value;
  const token = env.DISCORD_BOT_TOKEN;
  const kv = env.CTF_STATE;

  const key = `ctf:${guildId}:${ctfName}`;
  const ctfState = await kv.get(key, "json");

  if (!ctfState) {
    return `\u26a0\ufe0f **${ctfName}** CTF를 찾을 수 없습니다.`;
  }
  if (ctfState.archived) {
    return `\u{1f4e6} **${ctfName}**은(는) 이미 아카이브되었습니다.`;
  }

  // Archive 카테고리 확인/생성
  let archiveId = await kv.get(`archive:${guildId}`);
  if (!archiveId) {
    let archive = await findCategory(guildId, "CTF-Archive", token);
    if (!archive) {
      archive = await createCategory(guildId, "CTF-Archive", token);
    }
    archiveId = archive.id;
    await kv.put(`archive:${guildId}`, archiveId);
  }

  // 포럼 채널 이동 + 읽기전용
  if (ctfState.forumChannelId) {
    await moveChannel(ctfState.forumChannelId, archiveId, token);
    await makeReadOnly(ctfState.forumChannelId, guildId, token);
  }

  // 음성 채널 이동
  if (ctfState.voiceChannelId) {
    try {
      await moveChannel(ctfState.voiceChannelId, archiveId, token);
    } catch {
      // 음성 채널이 이미 삭제되었을 수 있음
    }
  }

  // KV 업데이트
  ctfState.archived = true;
  ctfState.archivedAt = new Date().toISOString();
  await kv.put(key, JSON.stringify(ctfState));

  const solved = ctfState.challenges.filter((c) => c.solved).length;
  const total = ctfState.challenges.length;

  return `\u{1f4e6} **${ctfName}** 아카이브 완료! (최종: ${solved}/${total} solved)`;
}
