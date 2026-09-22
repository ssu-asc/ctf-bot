// Only the approved ASC intake message can provision project interest rooms.
export const INTEREST_CONFIG = {
  guildId: "954797328500420638",
  categoryId: "1551969762362532010",
  channelId: "1551998867912917063",
  messageId: "1551999447032926349",
  staffRoleId: "956816028715868200",
  eligibleRoles: ["1218630064699342848", "970894835294830592", "954798111962828830", "956816028715868200"],
  fields: [
    { key: "web", name: "웹", emoji: "🌐" },
    { key: "pwn", name: "포너블", emoji: "💥" },
    { key: "rev", name: "리버싱", emoji: "🧩" },
    { key: "crypto", name: "암호학", emoji: "🔐" },
    { key: "forensic", name: "포렌식", emoji: "🔎" },
    { key: "other", name: "기타", emoji: "💡" },
  ],
};

const VIEW = 1024n;
const PARTICIPATE = String(VIEW | 2048n | 65536n | 32768n | 16384n | 64n | (1n << 31n) | (1n << 38n));
const normalEmoji = value => String(value).replace(/\uFE0F/g, "");

export class RequestBudgetReached extends Error {}

export function discordClient(token, fetcher = fetch, maxRequests = 45) {
  const secret = String(token || "").trim();
  if (!secret) throw new Error("Discord bot credential is missing");
  let requests = 0;
  return async (path, options = {}) => {
    if (++requests > maxRequests) throw new RequestBudgetReached("Deferred to the next scheduled run");
    const response = await fetcher(`https://discord.com/api/v10${path}`, {
      ...options,
      headers: {
        Authorization: /^bot /i.test(secret) ? secret : `Bot ${secret}`,
        "Content-Type": "application/json",
        ...(options.method && options.method !== "GET" ? { "X-Audit-Log-Reason": "ASC%202026-2%20project%20interest%20selection" } : {}),
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      // Never log response bodies, bot credentials, or member profile data.
      const error = new Error(`Discord interest sync returned HTTP ${response.status}`);
      error.status = response.status;
      if (response.status === 429) {
        const details = await response.json().catch(() => ({}));
        const seconds = Number(details.retry_after ?? response.headers.get("Retry-After"));
        error.retryAfterMs = Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds * 1000) : 60000;
      }
      throw error;
    }
    return response.status === 204 ? null : response.json();
  };
}

export async function reactionUsers(api, config, field, reaction) {
  const users = new Map();
  if (!reaction) return users;
  const types = [0];
  if (reaction.count_details?.burst > 0) types.push(1);
  for (const type of types) {
    let after = "";
    for (let page = 0; ; page++) {
      if (page >= 20) throw new Error("Reaction pagination limit reached; no membership changes applied");
      const suffix = new URLSearchParams({ limit: "100", type: String(type), ...(after ? { after } : {}) });
      const batch = await api(`/channels/${config.channelId}/messages/${config.messageId}/reactions/${encodeURIComponent(field.emoji)}?${suffix}`);
      if (!Array.isArray(batch)) throw new Error("Invalid reaction response");
      for (const user of batch) if (!user.bot) users.set(user.id, user);
      if (batch.length < 100) break;
      const next = batch.at(-1)?.id;
      if (!next || next === after) throw new Error("Reaction pagination did not advance");
      after = next;
    }
  }
  return users;
}

function safeRole(role) {
  return role && !role.managed && BigInt(role.permissions) === 0n;
}

function privateRoom(channel, config, roleId) {
  const overwrites = channel?.permission_overwrites || [];
  const everyone = overwrites.find(p => p.type === 0 && p.id === config.guildId);
  const field = overwrites.find(p => p.type === 0 && p.id === roleId);
  return channel?.type === 0 && channel.parent_id === config.categoryId &&
    !!everyone && (BigInt(everyone.deny) & VIEW) !== 0n &&
    (BigInt(everyone.allow || "0") & VIEW) === 0n &&
    !!field && (BigInt(field.allow) & VIEW) !== 0n &&
    overwrites.every(p => p.type !== 0 || [config.staffRoleId, roleId].includes(p.id) || (BigInt(p.allow || "0") & VIEW) === 0n);
}

async function ensureRoom(api, storage, config, field, state, roles, channels) {
  const roleName = `2026-2 관심 · ${field.name}`;
  const topic = `${field.emoji} ${field.name}에 관심 있는 멤버들이 주제를 제안하고 팀을 찾는 곳입니다. 팀은 2~3명 권장, 최대 4명이며 PM 1명을 정해 주시기 바랍니다.`;
  const title = `# ${field.name} 프로젝트 이야기`;
  const content = `${title}\n${field.name}에 관심 있는 분들이 모인 공간입니다. 해보고 싶은 일이나 궁금한 점부터 편하게 이야기해 주시기 바랍니다. 운영진도 프로젝트 후보를 함께 나눌 예정입니다.\n\n## 팀을 꾸릴 때\n- 마음이 맞는 분들과 **2~3명 권장, 최대 4명**으로 팀을 구성하고 **PM 1명**을 정해 주시기 바랍니다.\n- 구체적인 주제 제안과 추가 팀원 모집은 <#1551975502233993289>에 올려 주시기 바랍니다.\n- 팀 전용 채널이나 매칭이 필요하면 <#1551981136295624704>로 문의해 주시기 바랍니다.\n\n활동 일정과 제출 방법은 <#1551975266929213440>에서 확인할 수 있습니다.`;
  if (state.roleId) {
    if (!safeRole(roles.find(r => r.id === state.roleId))) throw new Error(`Stored ${field.key} role is missing or has changed permissions`);
  } else {
    const matches = roles.filter(r => r.name === roleName);
    if (matches.length > 1 || (matches.length === 1 && !safeRole(matches[0]))) throw new Error(`Ambiguous ${field.key} role`);
    const role = matches[0] || await api(`/guilds/${config.guildId}/roles`, {
      method: "POST", body: JSON.stringify({ name: roleName, permissions: "0", hoist: false, mentionable: false }),
    });
    if (!safeRole(role)) throw new Error("New interest role has unexpected permissions");
    if (!matches.length) roles.push(role);
    state.roleId = role.id;
    await storage.put(field.key, state);
  }
  if (state.channelId) {
    if (!privateRoom(channels.find(c => c.id === state.channelId), config, state.roleId)) throw new Error(`Stored ${field.key} room is missing or privacy has changed`);
  } else {
    const name = `관심-${field.name}`;
    const matches = channels.filter(c => c.name === name && c.parent_id === config.categoryId);
    if (matches.length > 1 || (matches.length === 1 && !privateRoom(matches[0], config, state.roleId))) throw new Error(`Ambiguous ${field.key} room`);
    const channel = matches[0] || await api(`/guilds/${config.guildId}/channels`, {
      method: "POST",
      body: JSON.stringify({
        name, type: 0, parent_id: config.categoryId,
        topic,
        permission_overwrites: [
          { id: config.guildId, type: 0, allow: "0", deny: String(VIEW) },
          { id: config.staffRoleId, type: 0, allow: PARTICIPATE, deny: "0" },
          { id: state.roleId, type: 0, allow: PARTICIPATE, deny: "0" },
        ],
      }),
    });
    if (!privateRoom(channel, config, state.roleId)) throw new Error("New interest room has unexpected permissions");
    if (!matches.length) channels.push(channel);
    state.channelId = channel.id;
    await storage.put(field.key, state);
  }
  if (!state.welcomeId) {
    // Recover an acknowledged Discord message if storage failed after sending it.
    const messages = await api(`/channels/${state.channelId}/messages?limit=100`);
    const existing = messages.find(m => m.author?.bot && m.content?.startsWith(title));
    const message = existing || await api(`/channels/${state.channelId}/messages`, {
      method: "POST", body: JSON.stringify({
        content,
        allowed_mentions: { parse: [] },
      }),
    });
    state.welcomeId = message.id;
    await storage.put(field.key, state);
  }
  // Update only the tracked bot welcome and the original generated topic.
  // Discord enforces message ownership; never replace a manually edited topic.
  if (state.copyVersion !== 2) {
    const welcome = await api(`/channels/${state.channelId}/messages/${state.welcomeId}`);
    if (!welcome.author?.bot || !welcome.content?.startsWith(title)) throw new Error(`Stored ${field.key} welcome has changed`);
    if (welcome.content !== content) await api(`/channels/${state.channelId}/messages/${state.welcomeId}`, {
      method: "PATCH", body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    });
    const room = channels.find(c => c.id === state.channelId);
    const oldTopic = `${field.emoji} ${field.name}에 관심 있는 멤버들이 주제를 제안하고 팀을 찾는 곳입니다. 팀은 2~3명 권장, 최대 4명이며 PM 1명을 정해주세요.`;
    if (room.topic === oldTopic) await api(`/channels/${state.channelId}`, { method: "PATCH", body: JSON.stringify({ topic }) });
    state.copyVersion = 2;
    await storage.put(field.key, state);
  }
}

export async function syncInterests(api, storage, config = INTEREST_CONFIG) {
  const stats = { granted: 0, revoked: 0, fields: 0, deferred: false };
  if ((await storage.get("retryAt")) > Date.now()) return { ...stats, deferred: true };
  try {
    const source = await api(`/channels/${config.channelId}`);
    if (source.guild_id !== config.guildId || source.parent_id !== config.categoryId) throw new Error("Interest intake does not match the configured server/category");
    const message = await api(`/channels/${config.channelId}/messages/${config.messageId}`);
    if (message.id !== config.messageId) throw new Error("Interest message mismatch");
    const roles = await api(`/guilds/${config.guildId}/roles`);
    const channels = await api(`/guilds/${config.guildId}/channels`);
    const members = new Map();
    const member = async id => {
      if (!members.has(id)) {
        try { members.set(id, await api(`/guilds/${config.guildId}/members/${id}`)); }
        catch (e) { if (e.status === 404) members.set(id, null); else throw e; }
      }
      return members.get(id);
    };
    const startField = (await storage.get("nextField")) || 0;
    const fields = [...config.fields.slice(startField), ...config.fields.slice(0, startField)];
    for (const field of fields) {
      await storage.put("nextField", (config.fields.indexOf(field) + 1) % config.fields.length);
      const reaction = message.reactions?.find(r => !r.emoji.id && normalEmoji(r.emoji.name) === normalEmoji(field.emoji));
      const desired = await reactionUsers(api, config, field, reaction);
      const state = await storage.get(field.key) || { members: [] };
      if (!desired.size && !state.roleId) continue;
      await ensureRoom(api, storage, config, field, state, roles, channels);
      const tracked = new Set(state.members);
      // Include only users managed by this feature; manual staff role assignments are untouched.
      const ids = [...new Set([...tracked, ...desired.keys()])].sort();
      const startMember = state.cursor ? (ids.indexOf(state.cursor) + 1) % (ids.length || 1) : 0;
      const orderedIds = [...ids.slice(startMember), ...ids.slice(0, startMember)];
      for (const id of orderedIds) {
        const current = await member(id);
        const eligible = current && config.eligibleRoles.some(role => current.roles.includes(role));
        const selected = desired.has(id) && eligible;
        const hasRole = current?.roles.includes(state.roleId);
        if (selected) {
          if (!hasRole) {
            // Record ownership before the idempotent PUT so a crash cannot leave
            // an untracked role grant. Pre-existing manual grants stay untracked.
            tracked.add(id);
            state.members = [...tracked];
            await storage.put(field.key, state);
            await api(`/guilds/${config.guildId}/members/${id}/roles/${state.roleId}`, { method: "PUT" });
            current.roles.push(state.roleId);
            stats.granted++;
          }
        } else if (tracked.has(id)) {
          if (hasRole) {
            await api(`/guilds/${config.guildId}/members/${id}/roles/${state.roleId}`, { method: "DELETE" });
            current.roles = current.roles.filter(r => r !== state.roleId);
            stats.revoked++;
          }
          tracked.delete(id);
        }
        state.members = [...tracked];
        state.cursor = id;
        await storage.put(field.key, state);
      }
      stats.fields++;
    }
  } catch (e) {
    if (!(e instanceof RequestBudgetReached) && e.status !== 429) throw e;
    if (e.status === 429) await storage.put("retryAt", Date.now() + (e.retryAfterMs || 60000));
    stats.deferred = true;
  }
  await storage.put("lastRun", { at: new Date().toISOString(), ...stats });
  return stats;
}

// The namespace is reachable only from this Worker's scheduled handler. There is
// no public synchronization endpoint and no new bypass of Discord signatures.
export class InterestCoordinator {
  constructor(state, env) { this.storage = state.storage; this.env = env; this.running = null; }
  async fetch(request) {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/sync") return new Response("Not found", { status: 404 });
    if (this.running) return new Response("Already running", { status: 202 });
    this.running = syncInterests(discordClient(this.env.DISCORD_BOT_TOKEN), this.storage);
    try { return Response.json(await this.running); }
    finally { this.running = null; }
  }
}

export async function scheduledInterests(env) {
  if (env.INTEREST_ROOMS_ENABLED !== "true") return;
  const id = env.INTEREST_COORDINATOR.idFromName(INTEREST_CONFIG.guildId);
  const response = await env.INTEREST_COORDINATOR.get(id).fetch("https://interest.internal/sync", { method: "POST" });
  if (!response.ok) throw new Error(`Interest coordinator failed: ${response.status}`);
  if (response.status !== 202) console.log("ASC interest sync", await response.json());
}
