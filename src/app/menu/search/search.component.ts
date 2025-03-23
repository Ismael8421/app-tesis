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
import { Firestore, collection, doc, getDoc, getDocs, query, where, limit } from '@angular/fire/firestore';

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
  
  // Colecciones para las diferentes carreras
  private carreraCollections = [
    'Informatica',
    'IEME',
    'MCM',
    'EMA',
    'Mecatronica',
    'Ciencias'
  ];
  
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
  
          // Cargar recomendaciones solo si el formulario está completo
          if (formCompleted && this.userData && this.formData) {
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
      if (!this.formData || !this.userData) {
        console.error('Faltan datos del usuario o del formulario');
        return;
      }

      const allPotentialMatches: any[] = [];
      const currentUserId = this.auth.currentUser?.uid;
      
      // Obtener carreras buscadas por el usuario
      const carrerasBuscadas = this.formData.carrera_buscada || [];
      
      // Si no hay carreras buscadas, buscar en todas las colecciones
      const collectionsToSearch = carrerasBuscadas.length > 0 
        ? carrerasBuscadas.map(carrera => this.normalizeCarreraName(carrera))
        : this.carreraCollections;
      
      // Buscar en cada colección correspondiente
      for (const collectionName of collectionsToSearch) {
        const carreraCollection = collection(this.firestore, collectionName);
        const q = query(carreraCollection, where('uid', '!=', currentUserId));
        
        const querySnapshot = await getDocs(q);
        
        // Para cada usuario en la colección
        for (const docSnap of querySnapshot.docs) {
          // Obtener la información general del usuario
          const userGeneralDoc = await getDoc(doc(this.firestore, 'usuarios', docSnap.id));
          const userData = userGeneralDoc.data();
          
          if (!userData) continue;
          
          const formCompleted = userData['formCompleted'] ?? false;
          const userYear = userData['anioLectivo'];

          if (this.userData?.anioLectivo === 'Tercero' && userYear === 'Segundo') {
            continue; // Saltar este usuario y continuar con el siguiente
          }
          // Si el usuario actual es de segundo, excluir a los de tercero
          if (this.userData?.anioLectivo === 'Segundo' && userYear === 'Tercero') {
            continue; // Saltar este usuario y continuar con el siguiente
          }
          
          // Solo considerar usuarios que hayan completado el formulario
          if (formCompleted) {
            // Priorizar usuarios de tercero como solicitaste
            const userFormData = docSnap.data();
            const userYear = userData['anioLectivo'];
            const userCarrera = userData['carrera'];
            
            // Calcular puntuación de compatibilidad
            const matchScore = this.calculateMatchScore(userFormData, userYear, userCarrera, docSnap.id);
            
            allPotentialMatches.push({
              uid: docSnap.id,
              nombreUsuario: userData['nombreUsuario'] || 'Usuario',
              nombre: userData['nombre'] || '',
              apellido: userData['apellido'] || '',
              carrera: userData['carrera'] || '',
              anioLectivo: userData['anioLectivo'] || '',
              mencion: userData['mencion'] || '',
              ...userFormData,
              matchScore: matchScore
            });
          }
        }
      }
      
      // Ordenar por puntuación de compatibilidad (mayor a menor)
      this.recommendedUsers = allPotentialMatches
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 10); // Limitar a 10 recomendaciones
      
    } catch (error) {
      console.error('Error al cargar recomendaciones:', error);
    }
  }

  // Función para normalizar el nombre de la carrera como aparece en Firestore
  private normalizeCarreraName(carrera: string): string {
    const carreraMap: {[key: string]: string} = {
      'informatica': 'Informatica',
      'ieme': 'IEME',
      'mcm': 'MCM',
      'ema': 'EMA',
      'mecatronica': 'Mecatronica',
      'ciencias': 'Ciencias'
    };
    
    return carreraMap[carrera.toLowerCase()] || carrera;
  }

  // Función principal de cálculo de compatibilidad
  private calculateMatchScore(otherUserData: any, otherUserYear: string, otherUserCarrera: string, otherUserId: string): number {
    if (!this.formData || !otherUserData) return 0;
    
    let matchScore = 0;
    
    // 1. Verificar si la carrera del otro usuario está entre las buscadas por el usuario actual
    const carreraAlias = {
      'Informatica': 'informatica',
      'IEME': 'ieme',
      'MCM': 'mcm',
      'EMA': 'ema',
      'Mecatronica': 'mecatronica',
      'Ciencias': 'ciencias'
    };
    
    const normalizedCarrera = carreraAlias[otherUserCarrera as keyof typeof carreraAlias] || '';
    
    if (this.formData.carrera_buscada.includes(normalizedCarrera)) {
      matchScore += 30; // Gran peso a coincidir con carreras buscadas
    }
    
    // 2. Priorizar usuarios de tercero (como solicitaste)
    if (this.userData?.anioLectivo === 'Tercero' && otherUserYear === 'Segundo') {
      return -1; // Puntuación negativa para que no aparezca en las recomendaciones
    }
    // Si ambos son del mismo año o el usuario actual es de segundo, priorizar terceros
    else if (otherUserYear === 'Tercero') {
      matchScore += 20;
    }
    
    // 3. Compatibilidad de horarios
    const commonSchedules = this.formData.horario.filter(
      horario => otherUserData.horario?.includes(horario)
    );
    matchScore += commonSchedules.length * 5;
    
    // 4. Compatibilidad de método de trabajo
    if (this.formData.metodo === otherUserData.metodo || this.formData.metodo === 'ambos' || otherUserData.metodo === 'ambos') {
      matchScore += 10;
    }
    
    // 5. Compatibilidad de horas
    if (this.formData.horas === otherUserData.horas || this.formData.horas === 'flexible' || otherUserData.horas === 'flexible') {
      matchScore += 5;
    }
    
    // 6. Evaluar match de habilidades (lo más importante)
    matchScore += this.evaluateSkillsMatch(otherUserData, otherUserCarrera, otherUserYear);
    
    return matchScore;
  }

  // Función para evaluar compatibilidad de habilidades
  private evaluateSkillsMatch(otherUserData: any, otherUserCarrera: string, otherUserYear: string): number {
    if (!this.formData) return 0;
    
    let skillMatchScore = 0;
    const valorHabilidad = { 'Alto': 3, 'Medio': 2, 'Bajo': 1 };
    
    // Obtener el alias normalizado de la carrera del otro usuario
    const carreraAlias = {
      'Informatica': 'informatica',
      'IEME': 'ieme',
      'MCM': 'mcm',
      'EMA': 'ema',
      'Mecatronica': 'mecatronica',
      'Ciencias': 'ciencias'
    };
    
    const otherUserCarreraAlias = carreraAlias[otherUserCarrera as keyof typeof carreraAlias] || '';
    
    // Solo verificar habilidades si la carrera del otro usuario es buscada por el usuario actual
    if (this.formData.carrera_buscada.includes(otherUserCarreraAlias)) {
      
      // Para usuarios de tercero
      if (otherUserYear === 'Tercero') {
        // Según la carrera, verificar las habilidades correspondientes
        switch (otherUserCarrera) {
          case 'Informatica':
            if (this.formData.habilidad_buscada_ter?.informatica_ter && otherUserData.habilidad_ofrecida_ter?.informatica_ter_of) {
              // Evaluar programación
              if (this.formData.habilidad_buscada_ter.informatica_ter.programacion && otherUserData.habilidad_ofrecida_ter.informatica_ter_of.programacion) {
                const valorBuscado = this.formData.habilidad_buscada_ter.informatica_ter.programacion;
                const valorOfrecido = otherUserData.habilidad_ofrecida_ter.informatica_ter_of.programacion;
                if (valorOfrecido && valorHabilidad[valorOfrecido as keyof typeof valorHabilidad] >= valorHabilidad[valorBuscado as keyof typeof valorHabilidad]) {
                  skillMatchScore += 5;
                }
              }
              
              // Evaluar diseño
              if (this.formData.habilidad_buscada_ter.informatica_ter.diseno && otherUserData.habilidad_ofrecida_ter.informatica_ter_of.diseno) {
                const valorBuscado = this.formData.habilidad_buscada_ter.informatica_ter.diseno;
                const valorOfrecido = otherUserData.habilidad_ofrecida_ter.informatica_ter_of.diseno;
                if (valorOfrecido && valorHabilidad[valorOfrecido as keyof typeof valorHabilidad] >= valorHabilidad[valorBuscado as keyof typeof valorHabilidad]) {
                  skillMatchScore += 5;
                }
              }
              
              // Evaluar CAD
              if (this.formData.habilidad_buscada_ter.informatica_ter.cad && otherUserData.habilidad_ofrecida_ter.informatica_ter_of.cad) {
                const valorBuscado = this.formData.habilidad_buscada_ter.informatica_ter.cad;
                const valorOfrecido = otherUserData.habilidad_ofrecida_ter.informatica_ter_of.cad;
                if (valorOfrecido && valorHabilidad[valorOfrecido as keyof typeof valorHabilidad] >= valorHabilidad[valorBuscado as keyof typeof valorHabilidad]) {
                  skillMatchScore += 5;
                }
              }
              
              // Evaluar soporte
              if (this.formData.habilidad_buscada_ter.informatica_ter.soporte && otherUserData.habilidad_ofrecida_ter.informatica_ter_of.soporte) {
                const valorBuscado = this.formData.habilidad_buscada_ter.informatica_ter.soporte;
                const valorOfrecido = otherUserData.habilidad_ofrecida_ter.informatica_ter_of.soporte;
                if (valorOfrecido && valorHabilidad[valorOfrecido as keyof typeof valorHabilidad] >= valorHabilidad[valorBuscado as keyof typeof valorHabilidad]) {
                  skillMatchScore += 5;
                }
              }
              
              // Evaluar móvil
              if (this.formData.habilidad_buscada_ter.informatica_ter.movil && otherUserData.habilidad_ofrecida_ter.informatica_ter_of.movil) {
                const valorBuscado = this.formData.habilidad_buscada_ter.informatica_ter.movil;
                const valorOfrecido = otherUserData.habilidad_ofrecida_ter.informatica_ter_of.movil;
                if (valorOfrecido && valorHabilidad[valorOfrecido as keyof typeof valorHabilidad] >= valorHabilidad[valorBuscado as keyof typeof valorHabilidad]) {
                  skillMatchScore += 5;
                }
              }
              
              // Evaluar web
              if (this.formData.habilidad_buscada_ter.informatica_ter.web && otherUserData.habilidad_ofrecida_ter.informatica_ter_of.web) {
                const valorBuscado = this.formData.habilidad_buscada_ter.informatica_ter.web;
                const valorOfrecido = otherUserData.habilidad_ofrecida_ter.informatica_ter_of.web;
                if (valorOfrecido && valorHabilidad[valorOfrecido as keyof typeof valorHabilidad] >= valorHabilidad[valorBuscado as keyof typeof valorHabilidad]) {
                  skillMatchScore += 5;
                }
              }
              
              // Evaluar redes
              if (this.formData.habilidad_buscada_ter.informatica_ter.redes && otherUserData.habilidad_ofrecida_ter.informatica_ter_of.redes) {
                const valorBuscado = this.formData.habilidad_buscada_ter.informatica_ter.redes;
                const valorOfrecido = otherUserData.habilidad_ofrecida_ter.informatica_ter_of.redes;
                if (valorOfrecido && valorHabilidad[valorOfrecido as keyof typeof valorHabilidad] >= valorHabilidad[valorBuscado as keyof typeof valorHabilidad]) {
                  skillMatchScore += 5;
                }
              }
            }
            break;
            
          // Aquí podrías agregar lógica similar para otras carreras
          case 'IEME':
            if (this.formData.habilidad_buscada_ter?.ieme_ter && otherUserData.habilidad_ofrecida_ter?.ieme_ter_of) {
              // Analizar cada habilidad relevante de IEME
              // (similar a lo que hicimos con Informática)
              const habilidadesBuscadas = this.formData.habilidad_buscada_ter.ieme_ter;
              const habilidadesOfrecidas = otherUserData.habilidad_ofrecida_ter.ieme_ter_of;
              
              // Evaluar cada habilidad de IEME tercero
              const habilidadesIEME = [
                'electrotecnia', 'instalaciones', 'automatismosEle', 'electronica', 
                'potencia', 'maquinas', 'industrial', 'microcontroladores',
                'electronicaAplicada', 'comunicaciones', 'redesComputadoras'
              ];
              
              for (const hab of habilidadesIEME) {
                if (habilidadesBuscadas[hab as keyof typeof habilidadesBuscadas] && 
                    habilidadesOfrecidas[hab as keyof typeof habilidadesOfrecidas]) {
                  const valorBuscado = habilidadesBuscadas[hab as keyof typeof habilidadesBuscadas];
                  const valorOfrecido = habilidadesOfrecidas[hab as keyof typeof habilidadesOfrecidas];
                  
                  if (valorOfrecido && valorBuscado && 
                      valorHabilidad[valorOfrecido as keyof typeof valorHabilidad] >= 
                      valorHabilidad[valorBuscado as keyof typeof valorHabilidad]) {
                    skillMatchScore += 5;
                  }
                }
              }
            }
            break;
            
          // Puedes agregar más casos para cada carrera
        }
      } 
      // Para usuarios de segundo
      else if (otherUserYear === 'Segundo') {
        // Implementación similar pero con habilidades de segundo año
        // Nota: Mencionaste que esto no está completamente implementado aún
        if (otherUserCarrera === 'Informatica' && 
            this.formData.habilidad_buscada_seg?.informatica_seg && 
            otherUserData.habilidad_ofrecida_seg?.informatica_seg_of) {
          
          const habilidadesBuscadas = this.formData.habilidad_buscada_seg.informatica_seg;
          const habilidadesOfrecidas = otherUserData.habilidad_ofrecida_seg.informatica_seg_of;
          
          // Evaluar cada habilidad de Informática segundo año
          const habilidadesInformaticaSeg = ['programacion', 'soporte', 'web', 'redes'];
          
          for (const hab of habilidadesInformaticaSeg) {
            if (habilidadesBuscadas[hab as keyof typeof habilidadesBuscadas] && 
                habilidadesOfrecidas[hab as keyof typeof habilidadesOfrecidas]) {
              const valorBuscado = habilidadesBuscadas[hab as keyof typeof habilidadesBuscadas];
              const valorOfrecido = habilidadesOfrecidas[hab as keyof typeof habilidadesOfrecidas];
              
              if (valorOfrecido && valorBuscado && 
                  valorHabilidad[valorOfrecido as keyof typeof valorHabilidad] >= 
                  valorHabilidad[valorBuscado as keyof typeof valorHabilidad]) {
                skillMatchScore += 5;
              }
            }
          }
        }
      }
    }
    
    return skillMatchScore;
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