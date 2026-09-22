/**
 * /endctf [name] - CTF를 종료하고 아카이브합니다.
 *
 * name 생략 시 현재 채널(general 등)로 CTF를 자동 판별합니다.
 *
 * Returns: string (followup 메시지 내용)
 */

import { findCtfByChannel } from "./chall.js";
import {
  listCategories,
  countChannelsInCategory,
  createCategory,
  moveChannel,
  makeReadOnly,
} from "../discord.js";

/** 아카이브 카테고리 이름 패턴: "90 자료보관 · CTF 0" 형태에서 번호 추출 */
const ARCHIVE_PATTERN = /^90\s*자료보관\s*.\s*CTF\s*(\d+)$/;

/** 디스코드 카테고리당 채널 수 상한 */
const CATEGORY_CHANNEL_LIMIT = 50;

/** 이번 아카이브로 옮길 채널 수 (포럼 + 음성) */
const CHANNELS_TO_MOVE = 2;

/**
 * 가장 번호가 큰 "90 자료보관 · CTF N" 카테고리를 찾습니다.
 * 자리가 부족하면 다음 번호 카테고리를 새로 만듭니다.
 */
async function resolveArchiveCategory(guildId, token) {
  const categories = await listCategories(guildId, token);

  let latest = null;
  for (const ch of categories) {
    const m = ARCHIVE_PATTERN.exec(ch.name.trim());
    if (!m) continue;
    const num = parseInt(m[1], 10);
    if (!latest || num > latest.num) latest = { num, channel: ch };
  }

  // 아카이브 카테고리가 하나도 없으면 0번 생성
  if (!latest) {
    return createCategory(guildId, "90 자료보관 · CTF 0", token);
  }

  const used = await countChannelsInCategory(guildId, latest.channel.id, token);
  if (used + CHANNELS_TO_MOVE <= CATEGORY_CHANNEL_LIMIT) {
    return latest.channel;
  }

  // 가득 찼으면 다음 번호 생성
  return createCategory(guildId, `90 자료보관 · CTF ${latest.num + 1}`, token);
}

export async function handleEndCtf(interaction, env) {
  const guildId = interaction.guild_id;
  const channelId = interaction.channel_id;
  const token = env.DISCORD_BOT_TOKEN;
  const kv = env.CTF_STATE;

  const nameOpt = interaction.data.options?.find((o) => o.name === "name");
  const inputName = nameOpt?.value;

  let key;
  let ctfState;

  if (inputName) {
    // 이름이 주어지면 정확히 일치하는 키를 먼저 찾고, 없으면 대소문자 무시로 재탐색
    key = `ctf:${guildId}:${inputName}`;
    ctfState = await kv.get(key, "json");

    if (!ctfState) {
      const prefix = `ctf:${guildId}:`;
      const listed = await kv.list({ prefix });
      const target = inputName.toLowerCase();
      const match = listed.keys.find(
        (k) => k.name.slice(prefix.length).toLowerCase() === target
      );
      if (match) {
        key = match.name;
        ctfState = await kv.get(key, "json");
      }
    }

    if (!ctfState) {
      return `\u26a0\ufe0f **${inputName}** CTF를 찾을 수 없습니다.`;
    }
  } else {
    // 이름 생략 시 현재 채널로 판별
    const found = await findCtfByChannel(guildId, channelId, kv, token);
    if (!found) {
      return "\u26a0\ufe0f CTF 채널에서 실행하거나 CTF 이름을 지정해주세요.";
    }
    key = found.key;
    ctfState = found.state;
  }

  const ctfName = ctfState.name;
  if (ctfState.archived) {
    return `\u{1f4e6} **${ctfName}**은(는) 이미 아카이브되었습니다.`;
  }

  // Archive 카테고리 결정 (마지막 번호 우선, 가득 차면 다음 번호 생성)
  const archive = await resolveArchiveCategory(guildId, token);
  const archiveId = archive.id;

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
