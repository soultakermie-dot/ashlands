// Точка входу інтерфейсу: запускає всі частини.
import { socket } from './net/socket.js';
import { session } from './state/session.js';
import { showScreen } from './ui/screens.js';
import { initConnectionStatus } from './ui/connectionStatus.js';
import { initServerInfo } from './ui/serverInfo.js';
import { initAuthScreen } from './ui/authScreen.js';
import { initUserBar } from './ui/userBar.js';
import { initAccountsPanel } from './ui/accountsPanel.js';
import { initCharactersPanel } from './ui/charactersPanel.js';
import { initCharacterReviewPanel } from './ui/characterReviewPanel.js';
import { initActiveCharacterBadge } from './ui/activeCharacterBadge.js';
import { initSidebar } from './ui/sidebar.js';
import { initWorldMap } from './ui/worldMap.js';
import { initModal } from './ui/modal.js';
import { initSidebarNav } from './ui/sidebarNav.js';
import { initCharacterDetails } from './ui/characterDetails.js';
import { initPlayersPanel } from './ui/playersPanel.js';
import { initAllCharactersPanel } from './ui/allCharactersPanel.js';
import { initItemLibraryPanel } from './ui/itemLibraryPanel.js';
import { initEditorToolbar } from './ui/editorToolbar.js';
import { initLocationEditor } from './ui/locationEditor.js';
import { initTravelStatus } from './ui/travelStatus.js';
import { initTravelDmPanel } from './ui/travelDmPanel.js';
import { initGroupBanner } from './ui/groupBanner.js';
import { initGroupPanel } from './ui/groupPanel.js';
import { initGroupsDmPanel } from './ui/groupsDmPanel.js';
import { initGamePauseControl } from './ui/gamePauseControl.js';
import { initDicePanel } from './ui/dicePanel.js';
import { initNotesPanel } from './ui/notesPanel.js';
import { initClockDisplay } from './ui/clockDisplay.js';
import { initClockControl } from './ui/clockControl.js';
import { initDungeonOverlay } from './ui/dungeonOverlay.js';
import { initDungeonsDmPanel } from './ui/dungeonsDmPanel.js';
import { dungeonsState } from './state/dungeons.js';
import { initBuilderView } from './builder/builderView.js';
import { editor } from './state/editorMode.js';
import { groupsState } from './state/groups.js';
import { setBadge } from './ui/sidebarNav.js';

const gameScreen = document.getElementById('game-screen');

// Повідомлення над картою (kind: 'error' — червоне, 'info' — зелене); зникає саме.
let mapMessageTimer = 0;
function showMapMessage(text, kind = 'error') {
  const m = gameScreen.querySelector('[data-map-message]');
  m.textContent = text;
  m.hidden = !text;
  m.classList.toggle('map-message--info', kind === 'info');
  clearTimeout(mapMessageTimer);
  if (text) mapMessageTimer = setTimeout(() => { m.hidden = true; }, 5000);
}


initConnectionStatus(socket, document.getElementById('connection-status'));
initServerInfo(socket, document.getElementById('server-info'));
initAuthScreen(document.getElementById('auth-screen'));
initUserBar();
const builder = initBuilderView(gameScreen.querySelector('[data-builder]'), {});
initWorldMap(gameScreen, { onBuildCity: (loc) => builder.open(loc) });
// Вийшли з режиму будівельника (чи з гри) — закриваємо 3D-сцену.
editor.onChange(({ mode }) => { if (mode !== 'builder' && builder.isOpen) builder.close(); });
initSidebar(document.getElementById('sidebar'), gameScreen.querySelector('[data-sidebar-toggle]'));
initModal(gameScreen.querySelector('[data-modal]'));
initSidebarNav(document.getElementById('sidebar'));
initCharacterDetails(gameScreen.querySelector('[data-modal]'));
initPlayersPanel(document.getElementById('players-panel'));
initAllCharactersPanel(document.getElementById('all-characters-panel'));
initItemLibraryPanel(document.getElementById('item-library-panel'));
initEditorToolbar(gameScreen.querySelector('[data-mode-switch]'), gameScreen.querySelector('[data-editor-toolbar]'));
initLocationEditor(gameScreen.querySelector('[data-location-editor]'));
initTravelStatus(gameScreen.querySelector('[data-travel-status]'));
initTravelDmPanel(gameScreen.querySelector('[data-travel-dm]'));
initGroupBanner(gameScreen.querySelector('[data-group-banner]'));
initGroupPanel(gameScreen.querySelector('[data-group-panel]'));
initGroupsDmPanel(gameScreen.querySelector('[data-groups-dm-panel]'));
initDicePanel(gameScreen.querySelector('[data-dice-panel]'), gameScreen.querySelector('[data-dice-toast]'));
initNotesPanel(gameScreen.querySelector('[data-notes-panel]'));
initClockDisplay(gameScreen.querySelector('[data-clock]'), gameScreen.querySelector('[data-map-night]'));
initClockControl(gameScreen.querySelector('[data-clock-control]'), { onMessage: showMapMessage });
initGamePauseControl(gameScreen.querySelector('[data-game-pause]'), { onMessage: showMapMessage });
initDungeonOverlay(gameScreen.querySelector('[data-dungeon-screen]'), gameScreen.querySelector('[data-dungeon-notice]'));
initDungeonsDmPanel(gameScreen.querySelector('[data-dungeons-dm-panel]'), gameScreen.querySelector('[data-dungeon-enter]'), { onMessage: showMapMessage });
// ДМ: скільки загонів зараз у катакомбах.
dungeonsState.onChange(({ runs }) => setBadge('dungeons', runs.length));
// ДМ: лічильник груп, де нічия в голосуванні (треба обрати лідера).
groupsState.onChange(({ all }) => setBadge('groups', all.filter((g) => g.vote?.stage === 'tie').length));
initActiveCharacterBadge(gameScreen.querySelector('[data-topbar-character]'));
initAccountsPanel(document.getElementById('accounts-panel'));
initCharactersPanel(document.getElementById('characters-panel'));
initCharacterReviewPanel(document.getElementById('character-review-panel'));

// Не увійшов — вхід; увійшов, але ДМ ще не пустив — очікування; інакше — гра.
function screenFor(user) {
  if (!user) return 'auth';
  return user.admitted ? 'home' : 'waiting';
}

session.onChange((user) => showScreen(screenFor(user)));

// При кожному (пере)підключенні до сервера відновлюємо вхід за токеном.
socket.on('connect', () => session.resume());
