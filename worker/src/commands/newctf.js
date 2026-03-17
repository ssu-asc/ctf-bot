/**
 * /newctf <name> - 새 CTF 환경을 생성합니다.
 *
 * 1. "CTF" 카테고리 확인/생성
 * 2. 포럼 채널 생성 (unsolved, solved, discussion 태그 포함)
 * 3. "general" 포스트 자동 생성 + 상태 메시지 핀
 * 4. 음성 채널 생성
 * 5. KV에 CTF 상태 저장
 *
 * Returns: string (followup 메시지 내용)
 */

import {
  findCategory,
  createCategory,
  createForumChannel,
  createForumPost,
  createVoiceChannel,
  pinMessage,
} from "../discord.js";

/** 포럼 태그 기본 설정 */
const FORUM_TAGS = [
  { name: "unsolved", moderated: false, emoji_name: "\u274c" },
  { name: "solved", moderated: false, emoji_name: "\u2705" },
  { name: "discussion", moderated: false, emoji_name: "\u{1f4ac}" },
];

export async function handleNewCtf(interaction, env) {
  const guildId = interaction.guild_id;
  const ctfName = interaction.data.options.find((o) => o.name === "name").value;
  const token = env.DISCORD_BOT_TOKEN;
  const kv = env.CTF_STATE;

  // 중복 확인
  const existingKey = `ctf:${guildId}:${ctfName}`;
  const existing = await kv.get(existingKey, "json");
  if (existing && !existing.archived) {
    return `\u26a0\ufe0f **${ctfName}** CTF가 이미 진행 중입니다.`;
  }

  // 1. CTF 카테고리 확인/생성 (항상 서버에서 확인)
  let category = await findCategory(guildId, "CTF", token);
  if (!category) {
    category = await createCategory(guildId, "CTF", token);
  }
  const categoryId = category.id;
  await kv.put(`category:${guildId}`, categoryId);

  // 2. 포럼 채널 생성
  const forum = await createForumChannel(
    guildId,
    ctfName,
    categoryId,
    token,
    FORUM_TAGS
  );

  // 태그 ID 매핑
  const tagMap = {};
  for (const tag of forum.available_tags || []) {
    tagMap[tag.name] = tag.id;
  }

  // 3. general 포스트 생성
  const statusContent = buildStatusMessage(ctfName, []);
  const generalPost = await createForumPost(
    forum.id,
    "general",
    statusContent,
    [tagMap["discussion"]],
    token
  );

  const generalThreadId = generalPost.id;
  const statusMessageId = generalPost.message?.id || generalPost.id;
  if (statusMessageId && generalThreadId) {
    try {
      await pinMessage(generalThreadId, statusMessageId, token);
    } catch {
      // 핀 실패해도 계속 진행
    }
  }

  // 4. 음성 채널 생성
  const voice = await createVoiceChannel(
    guildId,
    `\u{1f50a} ${ctfName} 회의실`,
    categoryId,
    token
  );

  // 5. KV에 상태 저장
  const ctfState = {
    name: ctfName,
    guildId,
    forumChannelId: forum.id,
    generalThreadId,
    statusMessageId,
    voiceChannelId: voice.id,
    tagMap,
    archived: false,
    challenges: [],
    createdAt: new Date().toISOString(),
  };
  await kv.put(existingKey, JSON.stringify(ctfState));

  return (
    `\u2705 **${ctfName}** CTF 환경이 생성되었습니다!\n` +
    `\u{1f4cb} 포럼: <#${forum.id}>\n` +
    `\u{1f50a} 음성: <#${voice.id}>\n\n` +
    `\`/chall <name> <category>\`로 문제를 추가하세요.`
  );
}

export function buildStatusMessage(ctfName, challenges) {
  const solved = challenges.filter((c) => c.solved);
  const total = challenges.length;
  const solvedCount = solved.length;

  let lines = [`\u{1f4ca} **${ctfName}** 진행 현황`, "\u2501".repeat(20)];

  if (total === 0) {
    lines.push("`/chall <name> <category>` 로 문제를 추가하세요.");
  } else {
    for (const ch of challenges) {
      const prefix = ch.solved ? "\u2705" : "\u274c";
      const label = ch.category ? `${ch.category}/${ch.name}` : ch.name;
      const solver = ch.solvedBy ? ` (<@${ch.solvedBy}>)` : "";
      lines.push(`${prefix} ${label}${solver}`);
    }
  }

  lines.push("\u2501".repeat(20));
  lines.push(`**${solvedCount}/${total} solved**`);

  return lines.join("\n");
}
