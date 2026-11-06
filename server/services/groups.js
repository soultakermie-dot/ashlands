// Групи (загони): кожен ходить сам, але разом.
// - Групу створює гравець: запрошує когось поруч; хто зібрав — той і лідер.
// - Лідер вирушає — решта натискають «Йти за лідером» (швидше, поки не наздоженуть).
// - Хто далі за lagRadiusM від лідера й не йде за ним довше lagGraceMs — випадає.
// - Переобрати лідера: голосування «так/ні» (≥50% «так») → вибір лідера; нічия — вирішує ДМ.
// - ДМ: розбити групу, вивести учасника, призначити лідера, пауза / продовження всієї групи.
import crypto from 'node:crypto';
import { config } from '../config.js';
import { stores } from '../storage/index.js';
import { CHARACTER_STATUS, findCharacter } from './characters.js';
import { GameError } from './errors.js';
import {
  cancelRequest, cancelTravel, currentPosition, isGamePaused, pauseCharacterTravel,
  resumeCharacterTravel, startTravel,
} from './travel.js';
import { displayNameOf, findUserById } from './users.js';
import { distanceMeters } from './world.js';

const G = () => config.groups;
const groups = () => stores.groups.data.groups;

const invites = new Map();   // characterId (кого запросили) → { fromId, groupId|null, expiresAt }
const lagSince = new Map();  // characterId → з якого моменту відстає
const votes = new Map();     // groupId → голосування (див. startVote)

// ---------- Пошук ----------

export function groupOf(characterId) {
  return groups().find((g) => g.members.some((m) => m.characterId === characterId)) ?? null;
}

function getGroup(id) {
  const g = typeof id === 'string' ? groups().find((x) => x.id === id) : null;
  if (!g) throw new GameError('Групу не знайдено');
  return g;
}

const memberIds = (g) => g.members.map((m) => m.characterId);
const nameOf = (g) => `Загін ${findCharacter(g.leaderId)?.name ?? '?'}`;
const distanceNow = (a, b, now) => distanceMeters(currentPosition(a, now), currentPosition(b, now));

// Персонаж, за якого гравець зараз грає (і який має бути в грі).
function activeCharacter(user) {
  const c = user.activeCharacterId && findCharacter(user.activeCharacterId);
  if (!c || c.status !== CHARACTER_STATUS.APPROVED) throw new GameError('Спершу виберіть персонажа');
  return c;
}

function save() {
  stores.groups.save();
}

// ---------- Склад групи ----------

function addMember(g, characterId) {
  g.members.push({ characterId, joinedAt: new Date().toISOString() });
  lagSince.delete(characterId);
}

// Прибрати учасника. Якщо пішов лідер — лідером стає той, хто в групі найдовше. Група з 1 людини зникає.
function removeMember(g, characterId) {
  g.members = g.members.filter((m) => m.characterId !== characterId);
  lagSince.delete(characterId);
  if (g.leaderId === characterId && g.members.length) {
    g.leaderId = [...g.members].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))[0].characterId;
  }
  votes.delete(g.id);
  if (g.members.length < 2) {
    for (const m of g.members) lagSince.delete(m.characterId);
    groups().splice(groups().indexOf(g), 1);
  }
  save();
}

// ---------- Запрошення ----------

export function invite(user, targetCharacterId, now = Date.now()) {
  const me = activeCharacter(user);
  const target = typeof targetCharacterId === 'string' ? findCharacter(targetCharacterId) : null;
  const owner = target && findUserById(target.userId);
  if (!target || owner?.activeCharacterId !== target.id || target.status !== CHARACTER_STATUS.APPROVED) {
    throw new GameError('Цей персонаж зараз не в грі');
  }
  if (target.id === me.id) throw new GameError('Не можна запросити самого себе');
  if (owner.id === user.id) throw new GameError('Це ваш персонаж');
  if (groupOf(target.id)) throw new GameError(`«${target.name}» уже в групі`);
  const mine = groupOf(me.id);
  if (mine && mine.leaderId !== me.id) throw new GameError('Запрошувати може лише лідер групи');
  const d = distanceNow(me, target, now);
  if (d === null || d > G().inviteRadiusM) throw new GameError(`Запросити можна лише того, хто поруч (до ${G().inviteRadiusM} м)`);
  invites.set(target.id, { fromId: me.id, expiresAt: now + G().inviteMs });
  return { from: me, target };
}

// Запрошення для персонажа (якщо є й не прострочене).
export function inviteFor(characterId, now = Date.now()) {
  const inv = invites.get(characterId);
  if (!inv) return null;
  if (inv.expiresAt < now) { invites.delete(characterId); return null; }
  const from = findCharacter(inv.fromId);
  return from ? { fromId: from.id, fromName: from.name, expiresAt: inv.expiresAt } : null;
}

export function answerInvite(user, accept, now = Date.now()) {
  const me = activeCharacter(user);
  const inv = inviteFor(me.id, now);
  invites.delete(me.id);
  if (!inv) throw new GameError('Запрошення вже нема');
  if (!accept) return { declined: true, fromId: inv.fromId };
  if (groupOf(me.id)) throw new GameError('Ви вже в групі');

  const from = findCharacter(inv.fromId);
  const d = from && distanceNow(me, from, now);
  if (d === null || d > G().inviteRadiusM) throw new GameError('Той, хто запрошував, уже далеко');

  let g = groupOf(from.id);
  if (g && g.leaderId !== from.id) throw new GameError('Той, хто запрошував, уже не лідер');
  if (!g) {
    g = { id: crypto.randomUUID(), leaderId: from.id, members: [], createdAt: new Date().toISOString() };
    addMember(g, from.id);
    groups().push(g);
  }
  addMember(g, me.id);
  save();
  return { group: g };
}

export function leaveGroup(user) {
  const me = activeCharacter(user);
  const g = groupOf(me.id);
  if (!g) throw new GameError('Ви не в групі');
  removeMember(g, me.id);
  return g;
}

// Гравець перемкнувся на іншого персонажа — попередній виходить з групи.
export function onCharacterDeselected(characterId) {
  invites.delete(characterId);
  const g = groupOf(characterId);
  if (g) removeMember(g, characterId);
}

// ---------- Йти за лідером ----------

export function followLeader(user, now = Date.now()) {
  const me = activeCharacter(user);
  const g = groupOf(me.id);
  if (!g) throw new GameError('Ви не в групі');
  if (g.leaderId === me.id) throw new GameError('Ви і є лідер');
  const leader = findCharacter(g.leaderId);
  if (!leader?.travel) throw new GameError('Лідер нікуди не йде');
  cancelRequest(me.id);
  startTravel(me, leader.travel.destinationId, now, { speed: leader.travel.speed, catchUp: { target: leader } });
  // Група на паузі — той, хто приєднався до руху, теж стоїть.
  if (!leader.travel.runningSince && leader.travel.pausedBy === 'dm') pauseCharacterTravel(me, 'dm', now);
  return { leader };
}

// Чи йде персонаж туди ж, куди лідер (тоді він не «відстає», навіть якщо позаду).
function isFollowing(member, leader) {
  return !!(member.travel && leader.travel && member.travel.destinationId === leader.travel.destinationId);
}

// Щосекунди: хто відстав довше дозволеного — випадає. Повертає [{ group, character }].
export function tickGroups(now = Date.now()) {
  const dropped = [];
  for (const g of [...groups()]) {
    const leader = findCharacter(g.leaderId);
    if (!leader) continue;
    for (const id of memberIds(g)) {
      if (id === g.leaderId) continue;
      const m = findCharacter(id);
      if (!m) { removeMember(g, id); continue; }
      const d = distanceNow(m, leader, now);
      const lagging = d !== null && d > G().lagRadiusM && !isFollowing(m, leader);
      if (!lagging) { lagSince.delete(id); continue; }
      if (!lagSince.has(id)) lagSince.set(id, now);
      if (now - lagSince.get(id) >= G().lagGraceMs) {
        dropped.push({ group: g, character: m, groupName: nameOf(g) });
        removeMember(g, id);
      }
    }
  }
  return dropped;
}

// ---------- Голосування ----------
// Крок 1 «confirm»: переобирати? так / ні. ≥50% «так» від усіх учасників → крок 2.
// Крок 2 «elect»: кожен голосує за одного учасника; найбільше голосів — лідер. Нічия → «tie», вирішує ДМ.

export function startVote(user, now = Date.now()) {
  const me = activeCharacter(user);
  const g = groupOf(me.id);
  if (!g) throw new GameError('Ви не в групі');
  if (votes.has(g.id)) throw new GameError('Голосування вже триває');
  votes.set(g.id, { stage: 'confirm', startedBy: me.id, yes: new Set([me.id]), no: new Set(), endsAt: now + G().voteMs });
  return resolveVote(g, now);
}

export function castVote(user, choice, now = Date.now()) {
  const me = activeCharacter(user);
  const g = groupOf(me.id);
  const v = g && votes.get(g.id);
  if (!v) throw new GameError('Голосування нема');
  if (v.stage === 'confirm') {
    if (typeof choice !== 'boolean') throw new GameError('Оберіть «так» або «ні»');
    v.yes.delete(me.id);
    v.no.delete(me.id);
    (choice ? v.yes : v.no).add(me.id);
  } else if (v.stage === 'elect') {
    if (!memberIds(g).includes(choice)) throw new GameError('Голосувати можна лише за учасника групи');
    v.ballots.set(me.id, choice);
  } else {
    throw new GameError('Голосування чекає рішення майстра');
  }
  return resolveVote(g, now);
}

// Підбити підсумки (після кожного голосу й за таймером). Повертає подію або null.
function resolveVote(g, now) {
  const v = votes.get(g.id);
  if (!v) return null;
  const n = g.members.length;
  if (v.stage === 'confirm') {
    if (v.yes.size * 2 >= n) {
      votes.set(g.id, { stage: 'elect', ballots: new Map(), endsAt: now + G().voteMs });
      return { event: 'elect' };
    }
    if (v.no.size * 2 > n || now >= v.endsAt) {
      votes.delete(g.id);
      return { event: 'rejected' };
    }
    return null;
  }
  if (v.stage === 'elect' && (v.ballots.size >= n || now >= v.endsAt)) {
    const count = new Map();
    for (const c of v.ballots.values()) count.set(c, (count.get(c) ?? 0) + 1);
    if (!count.size) { votes.delete(g.id); return { event: 'no-votes' }; }
    const max = Math.max(...count.values());
    const top = [...count].filter(([, k]) => k === max).map(([c]) => c);
    if (top.length === 1) {
      g.leaderId = top[0];
      votes.delete(g.id);
      save();
      return { event: 'elected', leaderId: top[0] };
    }
    votes.set(g.id, { stage: 'tie', candidates: top, endsAt: null });
    return { event: 'tie' };
  }
  return null;
}

// Щосекунди: голосування, у яких вийшов час.
export function tickVotes(now = Date.now()) {
  const events = [];
  for (const g of [...groups()]) {
    const v = votes.get(g.id);
    if (v?.endsAt && now >= v.endsAt) {
      const e = resolveVote(g, now);
      if (e) events.push({ group: g, ...e });
    }
  }
  for (const [id, inv] of invites) if (inv.expiresAt < now) invites.delete(id);
  return events;
}

// ---------- ДМ ----------

export function dmDisband(groupId) {
  const g = getGroup(groupId);
  for (const id of memberIds(g)) lagSince.delete(id);
  votes.delete(g.id);
  groups().splice(groups().indexOf(g), 1);
  save();
  return g;
}

export function dmRemoveMember(groupId, characterId) {
  const g = getGroup(groupId);
  if (!memberIds(g).includes(characterId)) throw new GameError('Цього персонажа нема в групі');
  removeMember(g, characterId);
  return g;
}

export function dmSetLeader(groupId, characterId) {
  const g = getGroup(groupId);
  if (!memberIds(g).includes(characterId)) throw new GameError('Лідером може бути лише учасник групи');
  g.leaderId = characterId;
  votes.delete(g.id);
  save();
  return g;
}

// Пауза / продовження всієї групи (окремого учасника групи ДМ не зупиняє).
export function dmPauseGroup(groupId, now = Date.now()) {
  const g = getGroup(groupId);
  if (isGamePaused()) throw new GameError('Уся гра й так на паузі');
  let any = false;
  for (const id of memberIds(g)) any = pauseCharacterTravel(findCharacter(id), 'dm', now) || any;
  if (!any) throw new GameError('Ніхто з групи зараз не йде');
  return g;
}

export function dmResumeGroup(groupId, now = Date.now()) {
  const g = getGroup(groupId);
  let any = false;
  for (const id of memberIds(g)) any = resumeCharacterTravel(findCharacter(id), 'dm', now) || any;
  if (!any) throw new GameError('Група не на паузі');
  return g;
}

export function dmCancelGroupTravel(groupId, now = Date.now()) {
  const g = getGroup(groupId);
  for (const id of memberIds(g)) {
    const c = findCharacter(id);
    if (c) { cancelTravel(c, now); cancelRequest(c.id); }
  }
  return g;
}

// ---------- Для клієнта ----------

function publicVote(g) {
  const v = votes.get(g.id);
  if (!v) return null;
  if (v.stage === 'confirm') return { stage: 'confirm', yes: [...v.yes], no: [...v.no], endsAt: v.endsAt };
  if (v.stage === 'elect') return { stage: 'elect', voted: [...v.ballots.keys()], endsAt: v.endsAt };
  return { stage: 'tie', candidates: v.candidates };
}

export function toPublicGroup(g, { forDm = false } = {}) {
  return {
    id: g.id,
    name: nameOf(g),
    leaderId: g.leaderId,
    members: [...g.members]
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
      .map((m) => {
        const c = findCharacter(m.characterId);
        const owner = c && findUserById(c.userId);
        return {
          characterId: m.characterId,
          name: c?.name ?? '?',
          ownerName: owner ? displayNameOf(owner) : '?',
          traveling: !!c?.travel,
          destinationName: c?.travel?.destinationName ?? null,
          lagging: lagSince.has(m.characterId),
          ...(forDm ? { ownerLogin: owner?.login } : {}),
        };
      }),
    vote: publicVote(g),
  };
}

export function listGroups(opts) {
  return groups().map((g) => toPublicGroup(g, opts));
}
