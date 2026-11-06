// Нотатки ДМ (лише ДМ): notes:list / create / update { noteId, title, body } / delete { noteId }.
import { createNote, deleteNote, listNotes, updateNote } from '../../services/notes.js';
import { handle } from '../handle.js';
import { DM_ROOM, requireDm } from '../identity.js';

export function registerNotes(io, socket) {
  // Зміни одразу бачить інший ДМ (крім того, хто змінив, — у нього вже все є).
  const share = () => socket.to(DM_ROOM).emit('notes:list', listNotes());

  socket.on('notes:list', handle(() => { requireDm(socket); return { notes: listNotes() }; }));

  socket.on('notes:create', handle(() => {
    requireDm(socket);
    const note = createNote();
    share();
    return { note };
  }));

  socket.on('notes:update', handle(({ noteId, title, body }) => {
    requireDm(socket);
    const note = updateNote(noteId, { title, body });
    share();
    return { note };
  }));

  socket.on('notes:delete', handle(({ noteId }) => {
    requireDm(socket);
    deleteNote(noteId);
    share();
    return {};
  }));
}
