// Зробити акаунт ДМом (або повернути гравцем).
// Використання:
//   npm run make-dm <логін>            — зробити ДМом
//   npm run make-dm <логін> -- --player — повернути роль гравця
// Сервер треба зупинити перед запуском (він тримає дані в пам'яті й перезапише зміни).
import net from 'node:net';
import { config } from '../server/config.js';
import { stores } from '../server/storage/index.js';
import { ROLES, findUserByLogin, setUserRole } from '../server/services/users.js';

const [login, flag] = process.argv.slice(2);

function isPortBusy(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(true))
      .once('listening', () => tester.close(() => resolve(false)))
      .listen(port);
  });
}

if (!login) {
  console.log('Вкажи логін: npm run make-dm <логін>');
  process.exit(1);
}

if (await isPortBusy(config.port)) {
  console.log('Спершу зупини сервер (Ctrl+C), а потім запусти цю команду знову.');
  process.exit(1);
}

const user = findUserByLogin(login);
if (!user) {
  console.log(`Акаунт «${login}» не знайдено. Спершу зареєструй його в грі.`);
  process.exit(1);
}

const role = flag === '--player' ? ROLES.PLAYER : ROLES.DM;
setUserRole(user, role);
stores.users.saveNow();
console.log(`Готово: «${user.login}» тепер ${role === ROLES.DM ? 'ДМ' : 'гравець'}.`);
