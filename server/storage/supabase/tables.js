// Як дані гри лежать у таблицях Supabase (див. supabase/migrations/).
// toRows: дані гри → рядки таблиці; fromRows: рядки таблиці → дані гри.

const iso = (ms) => (ms == null ? null : new Date(ms).toISOString());
const ms = (value) => (value == null ? null : new Date(value).getTime());

export const tables = {
  users: {
    table: 'users',
    key: 'id',
    defaults: { users: [] },
    toRows: ({ users }) => users.map((u) => ({
      id: u.id,
      login: u.login,
      display_name: u.displayName ?? u.login,
      password_hash: u.passwordHash,
      role: u.role,
      dm_note: u.dmNote ?? '',
      first_admitted_at: u.firstAdmittedAt ?? null,
      active_character_id: u.activeCharacterId ?? null,
      created_at: u.createdAt,
    })),
    fromRows: (rows) => ({
      users: rows.map((r) => ({
        id: r.id,
        login: r.login,
        displayName: r.display_name || r.login,
        passwordHash: r.password_hash,
        role: r.role,
        dmNote: r.dm_note,
        firstAdmittedAt: r.first_admitted_at,
        activeCharacterId: r.active_character_id,
        createdAt: r.created_at,
      })),
    }),
  },

  sessions: {
    table: 'sessions',
    key: 'token_hash',
    defaults: { sessions: {} },
    toRows: ({ sessions }) => Object.entries(sessions).map(([tokenHash, s]) => ({
      token_hash: tokenHash,
      user_id: s.userId,
      created_at: s.createdAt,
    })),
    fromRows: (rows) => ({
      sessions: Object.fromEntries(rows.map((r) => [r.token_hash, { userId: r.user_id, createdAt: r.created_at }])),
    }),
  },

  admissions: {
    table: 'admissions',
    key: 'user_id',
    defaults: { users: {} },
    toRows: ({ users }) => Object.entries(users).map(([userId, a]) => ({
      user_id: userId,
      admitted_at: a.admittedAt,
      away_since: iso(a.awaySince),
    })),
    fromRows: (rows) => ({
      users: Object.fromEntries(rows.map((r) => [r.user_id, { admittedAt: r.admitted_at, awaySince: ms(r.away_since) }])),
    }),
  },

  characters: {
    table: 'characters',
    key: 'id',
    defaults: { characters: [] },
    toRows: ({ characters }) => characters.map((c) => ({
      id: c.id,
      user_id: c.userId,
      name: c.name,
      avatar_path: c.avatarPath,
      status: c.status,
      pos_x: c.x ?? null,
      pos_y: c.y ?? null,
      sheet: c.sheet ?? {},
      gold: c.gold ?? 0,
      created_at: c.createdAt,
      reviewed_at: c.reviewedAt,
    })),
    fromRows: (rows) => ({
      characters: rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        name: r.name,
        avatarPath: r.avatar_path,
        status: r.status,
        x: r.pos_x,
        y: r.pos_y,
        sheet: r.sheet ?? {},
        gold: r.gold ?? 0,
        createdAt: r.created_at,
        reviewedAt: r.reviewed_at,
      })),
    }),
  },

  items: {
    table: 'items',
    key: 'id',
    defaults: { items: [] },
    toRows: ({ items }) => items.map((i) => ({
      id: i.id,
      name: i.name,
      kind: i.kind,
      description: i.description,
      stats: i.stats,
      image_path: i.imagePath,
      created_at: i.createdAt,
      updated_at: i.updatedAt,
    })),
    fromRows: (rows) => ({
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        kind: r.kind,
        description: r.description,
        stats: r.stats,
        imagePath: r.image_path,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    }),
  },

  inventory: {
    table: 'inventory',
    key: 'id',
    defaults: { entries: [] },
    toRows: ({ entries }) => entries.map((e) => ({
      id: e.id,
      character_id: e.characterId,
      item_id: e.itemId,
      quantity: e.quantity,
      custom_stats: e.customStats ?? null,
      created_at: e.createdAt,
    })),
    fromRows: (rows) => ({
      entries: rows.map((r) => ({
        id: r.id,
        characterId: r.character_id,
        itemId: r.item_id,
        quantity: r.quantity,
        customStats: r.custom_stats,
        createdAt: r.created_at,
      })),
    }),
  },

  locations: {
    table: 'locations',
    key: 'id',
    defaults: { locations: [] },
    toRows: ({ locations }) => locations.map((l) => ({
      id: l.id,
      type: l.type,
      name: l.name,
      description: l.description ?? '',
      x: l.x,
      y: l.y,
      created_at: l.createdAt,
    })),
    fromRows: (rows) => ({
      locations: rows.map((r) => ({
        id: r.id,
        type: r.type,
        name: r.name,
        description: r.description,
        x: r.x,
        y: r.y,
        createdAt: r.created_at,
      })),
    }),
  },

  roads: {
    table: 'roads',
    key: 'id',
    defaults: { roads: [] },
    toRows: ({ roads }) => roads.map((r) => ({
      id: r.id,
      from_id: r.fromId,
      to_id: r.toId,
      points: r.points ?? [],
      created_at: r.createdAt,
    })),
    fromRows: (rows) => ({
      roads: rows.map((r) => ({
        id: r.id,
        fromId: r.from_id,
        toId: r.to_id,
        points: r.points ?? [],
        createdAt: r.created_at,
      })),
    }),
  },

  // Налаштування світу (стартова точка тощо) — один рядок app_meta з ключем 'world'.
  worldSettings: {
    table: 'app_meta',
    key: 'key',
    defaults: { spawn: null, seeded: false },
    toRows: (data) => [{ key: 'world', value: data }],
    fromRows: (rows) => ({ spawn: null, seeded: false, ...(rows.find((r) => r.key === 'world')?.value ?? {}) }),
  },

  // Службова інформація — один рядок з ключем 'server'.
  meta: {
    table: 'app_meta',
    key: 'key',
    defaults: { launches: 0, firstLaunchAt: null, lastLaunchAt: null },
    toRows: (data) => [{ key: 'server', value: data }],
    fromRows: (rows) => ({
      launches: 0, firstLaunchAt: null, lastLaunchAt: null,
      ...(rows.find((r) => r.key === 'server')?.value ?? {}),
    }),
  },
};
