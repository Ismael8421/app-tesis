import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import '@angular/compiler';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
