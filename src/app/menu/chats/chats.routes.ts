import { Routes } from '@angular/router';

export default [
  {
    path: '',
    loadComponent: () => import('./messages-room/messages-room.component').then(m => m.MessagesRoomComponent)
  },
  {
    path: 'mensajes:/id',
    loadComponent: () => import('./message/message.component').then(m => m.MessageComponent)
  }
] as Routes;