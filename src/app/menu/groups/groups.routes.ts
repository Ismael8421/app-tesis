import { Routes } from '@angular/router';
import { GroupsComponent } from './groups.component';
import { InvitationsComponent } from './invitations/invitations.component';

export const GROUPS_ROUTES: Routes = [
  {
    path: '',
    component: GroupsComponent
  },
  {
    path: 'invitaciones',
    component: InvitationsComponent
  }
];