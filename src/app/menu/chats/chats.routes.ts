import { Routes } from '@angular/router';

export default [
  {
    path: '',
    loadComponent: () => import('./messages-room/messages-room.component')
      .then(m => m.MessagesRoomComponent)
  }
] as Routes;