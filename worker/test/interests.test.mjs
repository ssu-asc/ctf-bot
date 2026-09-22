import test from 'node:test';
import assert from 'node:assert/strict';
import { INTEREST_CONFIG, InterestCoordinator, RequestBudgetReached, discordClient, reactionUsers, syncInterests } from '../src/interests.js';
import worker from '../src/index.js';

const smallConfig = { ...INTEREST_CONFIG, fields: INTEREST_CONFIG.fields.slice(0, 2) };
function fixture(config = smallConfig) {
  const values = new Map();
  const storage = {
    async get(key) { return structuredClone(values.get(key)); },
    async put(key, value) { values.set(key, structuredClone(value)); },
  };
  const desired = new Map(config.fields.map(f => [f.emoji, []]));
  const members = new Map();
  const roles = [];
  const channels = [{ id: config.channelId, type: 0, guild_id: config.guildId, parent_id: config.categoryId }];
  const messages = new Map();
  const mutations = [];
  let serial = 0;
  const missing = () => { const e = new Error('Not found'); e.status = 404; throw e; };
  async function api(path, options = {}) {
    const url = new URL(path, 'https://mock.invalid');
    const p = url.pathname;
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : null;
    if (method !== 'GET') mutations.push({ path: p, method, body });
    if (p === `/channels/${config.channelId}`) return structuredClone(channels[0]);
    const channelEdit = p.match(/^\/channels\/([^/]+)$/);
    if (channelEdit && method === 'PATCH') {
      const room = channels.find(c => c.id === channelEdit[1]); if (!room) return missing();
      Object.assign(room, body); return structuredClone(room);
    }
    if (p === `/channels/${config.channelId}/messages/${config.messageId}`) return {
      id: config.messageId,
      reactions: [...desired].filter(([, u]) => u.length).map(([emoji, users]) => ({ emoji: { id: null, name: emoji }, count: users.length })),
    };
    const reaction = p.match(/\/reactions\/(.+)$/);
    if (reaction) {
      const users = desired.get(decodeURIComponent(reaction[1])) || [];
      const after = url.searchParams.get('after');
      const start = after ? users.findIndex(u => u.id === after) + 1 : 0;
      return structuredClone(users.slice(start, start + 100));
    }
    if (p === `/guilds/${config.guildId}/roles`) {
      if (method === 'GET') return structuredClone(roles);
      const role = { id: `role${++serial}`, managed: false, ...body };
      roles.push(role); return structuredClone(role);
    }
    if (p === `/guilds/${config.guildId}/channels`) {
      if (method === 'GET') return structuredClone(channels);
      const channel = { id: `room${++serial}`, guild_id: config.guildId, ...body };
      channels.push(channel); return structuredClone(channel);
    }
    const member = p.match(/\/members\/([^/]+)$/);
    if (member) return members.has(member[1]) ? structuredClone(members.get(member[1])) : missing();
    const grant = p.match(/\/members\/([^/]+)\/roles\/([^/]+)$/);
    if (grant) {
      const m = members.get(grant[1]); if (!m) return missing();
      if (method === 'PUT' && !m.roles.includes(grant[2])) m.roles.push(grant[2]);
      if (method === 'DELETE') m.roles = m.roles.filter(r => r !== grant[2]);
      return null;
    }
    const storedMessage = p.match(/\/channels\/([^/]+)\/messages\/([^/]+)$/);
    if (storedMessage) {
      const msg = messages.get(storedMessage[1])?.find(m => m.id === storedMessage[2]);
      if (!msg) return missing();
      if (method === 'PATCH') Object.assign(msg, body);
      return structuredClone(msg);
    }
    const message = p.match(/\/channels\/([^/]+)\/messages$/);
    if (message) {
      const list = messages.get(message[1]) || [];
      if (method === 'GET') return structuredClone(list);
      const msg = { id: `message${++serial}`, author: { bot: true }, ...body };
      list.push(msg); messages.set(message[1], list); return structuredClone(msg);
    }
    throw new Error(`Unexpected mock route: ${method} ${p}`);
  }
  function select(userId, fields = config.fields, eligible = true) {
    members.set(userId, { roles: eligible ? [config.eligibleRoles[0]] : [] });
    for (const field of fields) desired.get(field.emoji).push({ id: userId, bot: false });
  }
  return { config, api, storage, values, desired, members, roles, channels, messages, mutations, select };
}

test('multiple fields each get one private room and zero-permission role; repeat runs are idempotent', async () => {
  const f = fixture(); f.select('u1'); f.select('u2');
  const result = await syncInterests(f.api, f.storage, f.config);
  assert.equal(result.granted, 4);
  assert.equal(f.roles.length, 2); assert.equal(f.channels.length, 3);
  for (const role of f.roles) assert.equal(role.permissions, '0');
  for (const room of f.channels.slice(1)) {
    const everyone = room.permission_overwrites.find(p => p.id === f.config.guildId);
    assert.equal(everyone.deny, '1024'); assert.equal(everyone.allow, '0');
    assert.equal(room.permission_overwrites.length, 3);
    assert.ok(!room.permission_overwrites.some(p => p.id === f.config.eligibleRoles[0]));
  }
  const before = f.mutations.length;
  assert.equal((await syncInterests(f.api, f.storage, f.config)).granted, 0);
  assert.equal(f.mutations.length, before);
});

test('copy migration edits tracked welcomes once, keeps message IDs and preserves manually edited topics', async () => {
  const f = fixture(); f.select('u1'); await syncInterests(f.api, f.storage, f.config);
  for (const field of f.config.fields) {
    const state = f.values.get(field.key); delete state.copyVersion;
    const msg = f.messages.get(state.channelId).find(m => m.id === state.welcomeId);
    msg.content = `# ${field.name} 프로젝트 이야기\n이전에 게시된 안내예요.`;
    f.channels.find(c => c.id === state.channelId).topic = field.key === 'web'
      ? `${field.emoji} ${field.name}에 관심 있는 멤버들이 주제를 제안하고 팀을 찾는 곳입니다. 팀은 2~3명 권장, 최대 4명이며 PM 1명을 정해주세요.`
      : '운영진이 직접 정한 채널 설명';
  }
  const ids = [...f.messages.values()].flat().map(m => m.id);
  const before = f.mutations.length;
  await syncInterests(f.api, f.storage, f.config);
  assert.deepEqual([...f.messages.values()].flat().map(m => m.id), ids);
  assert.equal(f.mutations.slice(before).filter(m => m.method === 'PATCH' && m.path.includes('/messages/')).length, 2);
  assert.ok([...f.messages.values()].flat().every(m => m.content.includes('공간입니다.') && !m.content.includes('예요.')));
  assert.ok(f.channels[1].topic.endsWith('정해 주시기 바랍니다.'));
  assert.equal(f.channels[2].topic, '운영진이 직접 정한 채널 설명');
  const after = f.mutations.length; await syncInterests(f.api, f.storage, f.config);
  assert.equal(f.mutations.length, after);
});

test('reaction removal revokes only the corresponding managed role and preserves rooms/history', async () => {
  const f = fixture(); f.select('u1'); await syncInterests(f.api, f.storage, f.config);
  const web = await f.storage.get('web'), pwn = await f.storage.get('pwn');
  f.desired.set('🌐', []);
  const result = await syncInterests(f.api, f.storage, f.config);
  assert.equal(result.revoked, 1);
  assert.ok(!f.members.get('u1').roles.includes(web.roleId));
  assert.ok(f.members.get('u1').roles.includes(pwn.roleId));
  assert.equal(f.channels.length, 3); assert.equal(f.messages.size, 2);
  assert.ok(f.mutations.filter(m => m.method === 'DELETE').every(m => /\/members\/[^/]+\/roles\//.test(m.path)));
});

test('bots, ineligible members and departed members cannot gain access; eligibility loss revokes a tracked role', async () => {
  const f = fixture(); f.select('u1'); f.select('u2', f.config.fields, false);
  f.desired.get('🌐').push({ id: 'bot', bot: true }, { id: 'departed', bot: false });
  await syncInterests(f.api, f.storage, f.config);
  assert.equal(f.members.get('u2').roles.length, 0);
  f.members.get('u1').roles = f.members.get('u1').roles.filter(r => !f.config.eligibleRoles.includes(r));
  assert.equal((await syncInterests(f.api, f.storage, f.config)).revoked, 2);
});

test('normal and burst reaction users are paginated and deduplicated without dropping later users', async () => {
  const normal = Array.from({ length: 103 }, (_, i) => ({ id: String(i + 1) }));
  const calls = [];
  const api = async path => {
    const url = new URL(path, 'https://mock.invalid'); calls.push(url);
    if (url.searchParams.get('type') === '1') return [{ id: '2' }, { id: '104' }, { id: 'robot', bot: true }];
    return url.searchParams.has('after') ? normal.slice(100) : normal.slice(0, 100);
  };
  const users = await reactionUsers(api, smallConfig, smallConfig.fields[0], { count_details: { burst: 3 } });
  assert.equal(users.size, 104); assert.equal(calls.length, 3);
  assert.ok(calls[1].searchParams.get('after') === '100');
});

test('budget exhaustion resumes across members and fields without starvation', async () => {
  const f = fixture();
  for (let i = 0; i < 60; i++) f.select(`u${String(i).padStart(3, '0')}`);
  for (let run = 0; run < 30; run++) {
    let count = 0;
    await syncInterests(async (...args) => {
      if (++count > 24) throw new RequestBudgetReached();
      return f.api(...args);
    }, f.storage, f.config);
  }
  assert.equal((await f.storage.get('web')).members.length, 60);
  assert.equal((await f.storage.get('pwn')).members.length, 60);
  assert.equal(f.channels.length, 3);
});

test('a changed privileged role or manually deleted room is not silently recreated or assigned', async () => {
  const f = fixture(); f.select('u1'); await syncInterests(f.api, f.storage, f.config);
  f.roles[0].permissions = '8';
  await assert.rejects(syncInterests(f.api, f.storage, f.config), /role is missing or has changed/);
  f.roles[0].permissions = '0';
  const stored = await f.storage.get('web');
  f.channels.splice(f.channels.findIndex(c => c.id === stored.channelId), 1);
  await assert.rejects(syncInterests(f.api, f.storage, f.config), /room is missing/);
  assert.equal(f.roles.length, 2); assert.equal(f.channels.length, 2);
});

test('failed reaction reads never turn into mass removal', async () => {
  const f = fixture(); f.select('u1'); await syncInterests(f.api, f.storage, f.config);
  const roles = structuredClone(f.members.get('u1').roles);
  await assert.rejects(syncInterests(async (p, o) => {
    if (p.includes('/reactions/')) throw new Error('upstream unavailable');
    return f.api(p, o);
  }, f.storage, f.config));
  assert.deepEqual(f.members.get('u1').roles, roles);
});

test('a crash after the role grant is recoverable and later reaction removal still works', async () => {
  const f = fixture({ ...smallConfig, fields: smallConfig.fields.slice(0, 1) }); f.select('u1');
  let fail = true;
  await assert.rejects(syncInterests(async (p, o) => {
    const result = await f.api(p, o);
    if (o?.method === 'PUT' && fail) { fail = false; throw new Error('lost response'); }
    return result;
  }, f.storage, f.config));
  f.desired.set('🌐', []);
  assert.equal((await syncInterests(f.api, f.storage, f.config)).revoked, 1);
});

test('manually assigned field roles are not adopted and removed by the automation', async () => {
  const f = fixture(); f.select('u1'); await syncInterests(f.api, f.storage, f.config);
  const role = (await f.storage.get('web')).roleId;
  f.members.set('manual', { roles: [f.config.eligibleRoles[0], role] });
  f.desired.get('🌐').push({ id: 'manual' });
  await syncInterests(f.api, f.storage, f.config);
  f.desired.set('🌐', []); await syncInterests(f.api, f.storage, f.config);
  assert.ok(f.members.get('manual').roles.includes(role));
});

test('the coordinator serializes overlapping scheduled runs', async () => {
  const f = fixture(INTEREST_CONFIG); f.select('u1', [INTEREST_CONFIG.fields[0]]);
  const original = globalThis.fetch;
  let release; const gate = new Promise(resolve => { release = resolve; });
  let firstCall = true;
  globalThis.fetch = async (url, options) => {
    if (firstCall) { firstCall = false; await gate; }
    const result = await f.api(new URL(url).pathname.replace(/^\/api\/v10/, '') + new URL(url).search, options);
    return result === null ? new Response(null, { status: 204 }) : Response.json(result);
  };
  try {
    const coordinator = new InterestCoordinator({ storage: f.storage }, { DISCORD_BOT_TOKEN: 'test-credential' });
    const request = () => new Request('https://internal/sync', { method: 'POST' });
    const first = coordinator.fetch(request());
    assert.equal((await coordinator.fetch(request())).status, 202);
    release(); assert.equal((await first).status, 200);
    assert.equal(f.channels.length, 2);
  } finally { release(); globalThis.fetch = original; }
});

test('rate-limit errors are safe to retry and redact upstream bodies', async () => {
  const api = discordClient('test-credential', async () => new Response('private upstream detail', { status: 429 }));
  await assert.rejects(api('/test'), e => e.status === 429 && !e.message.includes('private'));
});

test('existing HTTP methods and Discord signature checks remain enforced', async () => {
  assert.equal((await worker.fetch(new Request('https://worker.invalid'), {}, {})).status, 405);
  assert.equal((await worker.fetch(new Request('https://worker.invalid/sync', { method: 'POST', body: '{}' }), {}, {})).status, 401);
  const keys = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const hex = array => Buffer.from(array).toString('hex');
  const publicKey = hex(await crypto.subtle.exportKey('raw', keys.publicKey));
  const body = JSON.stringify({ type: 1 }), timestamp = '1234567890';
  const signature = hex(await crypto.subtle.sign('Ed25519', keys.privateKey, new TextEncoder().encode(timestamp + body)));
  const request = new Request('https://worker.invalid', { method: 'POST', body, headers: { 'X-Signature-Ed25519': signature, 'X-Signature-Timestamp': timestamp } });
  assert.deepEqual(await (await worker.fetch(request, { DISCORD_PUBLIC_KEY: publicKey }, {})).json(), { type: 1 });
});

test('a rate-limit retry deadline prevents early resubmission', async () => {
  const f = fixture(); let calls = 0;
  const limited = async () => { calls++; const e = new Error('limited'); e.status = 429; e.retryAfterMs = 120000; throw e; };
  assert.equal((await syncInterests(limited, f.storage, f.config)).deferred, true);
  assert.equal((await syncInterests(limited, f.storage, f.config)).deferred, true);
  assert.equal(calls, 1);
});
