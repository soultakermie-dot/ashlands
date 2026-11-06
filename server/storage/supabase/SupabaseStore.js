// Сховище в таблиці Supabase.
// Як і JsonStore: дані в пам'яті (this.data), а save() трохи згодом записує в базу лише змінені рядки.
// Перетворення «дані гри ↔ рядки таблиці» описане в tables.js.

const SAVE_DELAY_MS = 200;
const RETRY_DELAY_MS = 5000;
const PAGE_SIZE = 1000;

export class SupabaseStore {
  /**
   * @param client  клієнт Supabase
   * @param spec    { table, key, defaults, toRows(data), fromRows(rows) }
   * @param dependsOn  сховища, які треба зберегти раніше (наприклад, users перед sessions)
   */
  constructor(client, spec, dependsOn = []) {
    this.client = client;
    this.spec = spec;
    this.dependsOn = dependsOn;
    this.data = structuredClone(spec.defaults);
    this.timer = null;
    this.chain = Promise.resolve();   // записи йдуть строго по черзі
    this.synced = new Map();          // ключ рядка → JSON рядка, як він зараз лежить у базі
  }

  async load() {
    const rows = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await this.client
        .from(this.spec.table)
        .select('*')
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw describeError(this.spec.table, error);
      rows.push(...data);
      if (data.length < PAGE_SIZE) break;
    }
    this.data = this.spec.fromRows(rows);
    this.synced = this.#snapshot();
  }

  save() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.saveNow(), SAVE_DELAY_MS);
  }

  hasPendingSave() {
    return this.timer !== null;
  }

  saveNow() {
    clearTimeout(this.timer);
    this.timer = null;
    this.chain = this.chain.then(() => this.#sync());
    return this.chain;
  }

  // Рядки поточних даних у вигляді «ключ → JSON».
  #snapshot() {
    const map = new Map();
    for (const row of this.spec.toRows(this.data)) map.set(String(row[this.spec.key]), JSON.stringify(row));
    return map;
  }

  async #sync() {
    for (const dep of this.dependsOn) {
      if (dep.hasPendingSave()) await dep.saveNow();
    }

    const current = this.#snapshot();
    const upserts = [...current].filter(([k, json]) => this.synced.get(k) !== json).map(([, json]) => JSON.parse(json));
    const deletes = [...this.synced.keys()].filter((k) => !current.has(k));
    if (!upserts.length && !deletes.length) return;

    try {
      const { table, key } = this.spec;
      if (upserts.length) {
        const { error } = await this.client.from(table).upsert(upserts, { onConflict: key });
        if (error) throw describeError(table, error);
      }
      if (deletes.length) {
        const { error } = await this.client.from(table).delete().in(key, deletes);
        if (error) throw describeError(table, error);
      }
      this.synced = current;
    } catch (err) {
      // Нема інтернету чи база недоступна — дані лишаються в пам'яті, спробуємо пізніше.
      console.error(`[supabase] Не вдалося зберегти «${this.spec.table}», повтор через ${RETRY_DELAY_MS / 1000} с:`, err.message);
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.saveNow(), RETRY_DELAY_MS);
    }
  }
}

function describeError(table, error) {
  const missing = error.code === 'PGRST205' || error.code === '42P01';
  const hint = missing ? ` (таблиці нема — запусти supabase/all.sql у Supabase → SQL Editor)` : '';
  return new Error(`${table}: ${error.message}${hint}`);
}
