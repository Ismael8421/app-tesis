import { NgIf, NgFor, CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, Component, inject } from '@angular/core';
import { Auth, User } from '@angular/fire/auth';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { register } from 'swiper/element/bundle';
import { ChatService } from '../chats/data-access/chat.service';
import { Observable } from 'rxjs';
import { AlertController } from '@ionic/angular';
import { FormStateService } from '../../form/data-access/form-state.service';
import { CheckIconComponent } from '../../UI/check-icon/check-icon.component';
import { MessagesIconComponent } from '../../UI/messages-icon/messages-icon.component';
import { HeartIconComponent } from '../../UI/heart-icon/heart-icon.component';
import { RegisterService, userCreate } from '../../register/data-access/register.service';
import { FormService, formCreate } from '../../form/data-access/form.service';
import { IonAlert, IonAvatar, IonButton, IonCard, IonCardContent, IonImg, IonSpinner, IonText } from '@ionic/angular/standalone';
import { Firestore, collection, doc, getDoc, getDocs, query, where } from '@angular/fire/firestore';

register();

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [
    NgIf,
    NgFor,
    ReactiveFormsModule,
    CommonModule,
    CheckIconComponent,
    MessagesIconComponent,
    HeartIconComponent,
    IonCard, IonCardContent, IonAvatar, IonImg, IonText, IonButton, IonAlert, IonSpinner 
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss'
})
export class SearchComponent {
  private auth = inject(Auth);
  private router = inject(Router);
  private chatService = inject(ChatService);
  private formStateService = inject(FormStateService);
  private registerService = inject(RegisterService);
  private formService = inject(FormService);
  private firestore = inject(Firestore);

  recommendedUsers: any[] = [];

  loading = true;

  userData: userCreate | null = null;
  formData: formCreate | null = null;
  isFormComplete: boolean = true;
  showAlert: boolean = false;
  
  alertButtons = [{
    text: 'Ir',
    handler: () => {
      this.navegateToForm();
    }
  }];

  navegateToForm() {
    this.router.navigateByUrl('/menu/form');
  }

  currentUser$ = new Observable<User | null>(observer => {
    return this.auth.onAuthStateChanged(observer);
  });

  async ngOnInit() {
    setTimeout(async () => {
      try {
        const user = this.auth.currentUser;
        if (user) {
          // Cargar datos de ambos servicios en paralelo junto con la verificación del formulario
          const [registerData, formData, formCompleted] = await Promise.all([
            this.registerService.getUserData(user.uid),
            this.formService.getFormData(user.uid),
            this.formStateService.checkFormCompletion(user.uid)
          ]);
  
          this.userData = registerData;
          this.formData = formData;
          this.isFormComplete = formCompleted;
          this.showAlert = !formCompleted;
  
          // ÚNICA LÍNEA NUEVA: Cargar recomendaciones solo si el formulario está completo
          if (formCompleted && this.userData) {
            await this.loadRecommendations();
          }
        }
        this.loading = false;
      } catch (error) {
        console.error('Error al cargar datos:', error);
        this.isFormComplete = false;
        this.showAlert = true;
        this.loading = false;
      }
    }, 1000);
  }

  async loadRecommendations() {
    try {
      const informaticaRef = collection(this.firestore, 'Informatica');
      
      let q = query(
        informaticaRef,
        where('uid', '!=', this.auth.currentUser?.uid)
      );
  
      const querySnapshot = await getDocs(q);
      const users: any[] = [];
  
      for (const docSnap of querySnapshot.docs) {
        const userGeneralDoc = await getDoc(doc(this.firestore, 'usuarios', docSnap.id));
        const formCompleted = userGeneralDoc.data()?.['formCompleted'] ?? false;
  
        if (formCompleted) {
          const userData = docSnap.data();
          users.push({
            ...userData,
            id: docSnap.id
          });
        }
      }
  
      this.recommendedUsers = users;
    } catch (error) {
      console.error('Error al cargar recomendaciones:', error);
    }
  }

  private isCompatible(otherUser: any): boolean {
    if (!this.formData || !otherUser) return false;

    // Verificar compatibilidad de horarios
    const hasCommonSchedule = this.formData.horario.some(
      horario => otherUser.horario?.includes(horario)
    );

    // Verificar método de estudio compatible
    const hasCompatibleMethod = this.formData.metodo === otherUser.metodo;

    // Verificar horas disponibles compatibles
    const hasCompatibleHours = this.formData.horas === otherUser.horas;

    return hasCommonSchedule && hasCompatibleMethod && hasCompatibleHours;
  }


  async startChat(otherUserId: string, otherUserName: string) {
    const currentUser = this.auth.currentUser;
    if (!currentUser) {
      console.error('No user logged in');
      return;
    }
  
    try {
      const chatId = await this.chatService.startChat(currentUser.uid, otherUserId);
      if (chatId) {
        this.router.navigate(['/menu/mensajes', chatId]);
      }
    } catch (error) {
      console.error('Error starting chat:', error);
    }
  }
}

