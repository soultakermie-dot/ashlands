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
        createdAt: r.created_at,
        reviewedAt: r.reviewed_at,
      })),
    }),
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
