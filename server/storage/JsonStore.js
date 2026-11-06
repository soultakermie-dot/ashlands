// Одне сховище = один JSON-файл у папці data/.
// Дані тримаються в пам'яті, а на диск пишуться трохи згодом (щоб не писати на кожну дрібницю).
// Запис безпечний: спершу у тимчасовий файл, потім заміна, тож при збої файл не зіпсується.
import fs from 'node:fs';
import path from 'node:path';

const SAVE_DELAY_MS = 200;

export class JsonStore {
  constructor(filePath, defaults) {
    this.filePath = filePath;
    this.defaults = defaults;
    this.timer = null;
    this.data = this.#load();
  }

  // Позначити, що дані змінились: збереження відбудеться автоматично.
  save() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.saveNow(), SAVE_DELAY_MS);
  }

  // Записати на диск негайно.
  saveNow() {
    clearTimeout(this.timer);
    this.timer = null;
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.filePath);
  }

  hasPendingSave() {
    return this.timer !== null;
  }

  #load() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });

    if (!fs.existsSync(this.filePath)) {
      return structuredClone(this.defaults);
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      return { ...structuredClone(this.defaults), ...parsed };
    } catch (err) {
      // Файл пошкоджений: відкладаємо його вбік, щоб нічого не втратити, і стартуємо з чистого.
      const backup = `${this.filePath}.broken-${Date.now()}`;
      fs.renameSync(this.filePath, backup);
      console.error(`[storage] Пошкоджений файл ${this.filePath}, збережено копію: ${backup}`, err.message);
      return structuredClone(this.defaults);
    }
  }
}
