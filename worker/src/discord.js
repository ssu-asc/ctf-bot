/**
 * Discord REST API 유틸리티.
 */

const DISCORD_API = "https://discord.com/api/v10";

/**
 * Discord API 요청을 보냅니다.
 */
async function discordFetch(path, token, options = {}) {
  const resp = await fetch(`${DISCORD_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Discord API ${resp.status}: ${text}`);
  }

  // 204 No Content 등
  if (resp.status === 204) return null;
  return resp.json();
}

/**
 * 길드의 카테고리 채널을 이름으로 찾습니다.
 */
export async function findCategory(guildId, name, token) {
  const channels = await discordFetch(`/guilds/${guildId}/channels`, token);
  return channels.find(
    (ch) => ch.type === 4 && ch.name.toLowerCase() === name.toLowerCase()
  );
}

/**
 * 카테고리 채널을 생성합니다.
 */
export async function createCategory(guildId, name, token) {
  return discordFetch(`/guilds/${guildId}/channels`, token, {
    method: "POST",
    body: JSON.stringify({ name, type: 4 }),
  });
}

/**
 * 포럼 채널을 생성합니다 (type 15).
 */
export async function createForumChannel(
  guildId,
  name,
  categoryId,
  token,
  tags = []
) {
  return discordFetch(`/guilds/${guildId}/channels`, token, {
    method: "POST",
    body: JSON.stringify({
      name,
      type: 15, // GUILD_FORUM
      parent_id: categoryId,
      available_tags: tags,
      default_sort_order: 0, // LATEST_ACTIVITY
    }),
  });
}

/**
 * 포럼에 새 포스트(쓰레드)를 생성합니다.
 */
export async function createForumPost(
  forumChannelId,
  name,
  content,
  tagIds,
  token
) {
  return discordFetch(`/channels/${forumChannelId}/threads`, token, {
    method: "POST",
    body: JSON.stringify({
      name,
      message: { content },
      applied_tags: tagIds || [],
      auto_archive_duration: 10080, // 7일
    }),
  });
}

/**
 * 음성 채널을 생성합니다.
 */
export async function createVoiceChannel(guildId, name, categoryId, token) {
  return discordFetch(`/guilds/${guildId}/channels`, token, {
    method: "POST",
    body: JSON.stringify({
      name,
      type: 2, // GUILD_VOICE
      parent_id: categoryId,
    }),
  });
}

/**
 * 채널을 다른 카테고리로 이동합니다.
 */
export async function moveChannel(channelId, newCategoryId, token) {
  return discordFetch(`/channels/${channelId}`, token, {
    method: "PATCH",
    body: JSON.stringify({ parent_id: newCategoryId }),
  });
}

/**
 * 채널의 권한을 읽기전용으로 변경합니다.
 */
export async function makeReadOnly(channelId, guildId, token) {
  return discordFetch(
    `/channels/${channelId}/permissions/${guildId}`,
    token,
    {
      method: "PUT",
      body: JSON.stringify({
        id: guildId,
        type: 0, // role
        deny: "2048", // SEND_MESSAGES
      }),
    }
  );
}

/**
 * 메시지를 전송합니다.
 */
export async function sendMessage(channelId, content, token) {
  return discordFetch(`/channels/${channelId}/messages`, token, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

/**
 * 메시지를 수정합니다.
 */
export async function editMessage(channelId, messageId, content, token) {
  return discordFetch(`/channels/${channelId}/messages/${messageId}`, token, {
    method: "PATCH",
    body: JSON.stringify({ content }),
  });
}

/**
 * 메시지를 핀합니다.
 */
export async function pinMessage(channelId, messageId, token) {
  return discordFetch(`/channels/${channelId}/pins/${messageId}`, token, {
    method: "PUT",
  });
}

/**
 * 쓰레드의 태그를 변경합니다.
 */
export async function updateThreadTags(threadId, tagIds, token) {
  return discordFetch(`/channels/${threadId}`, token, {
    method: "PATCH",
    body: JSON.stringify({ applied_tags: tagIds }),
  });
}

/**
 * 채널 정보를 가져옵니다.
 */
export async function getChannel(channelId, token) {
  return discordFetch(`/channels/${channelId}`, token);
}
