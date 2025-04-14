import { NgIf, NgFor, CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, Component, inject } from '@angular/core';
import { Auth, User } from '@angular/fire/auth';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { register } from 'swiper/element/bundle';
import { ChatService } from '../chats/data-access/chat.service';
import { Observable } from 'rxjs';
import { FormStateService } from '../../form/data-access/form-state.service';
import { CheckIconComponent } from '../../UI/check-icon/check-icon.component';
import { MessagesIconComponent } from '../../UI/messages-icon/messages-icon.component';
import { HeartIconComponent } from '../../UI/heart-icon/heart-icon.component';
import { RegisterService, userCreate } from '../../register/data-access/register.service';
import { FormService, formCreate } from '../../form/data-access/form.service';
import { AlertController, IonAlert, IonAvatar, IonButton, IonCard, IonCardContent, IonContent, IonIcon, IonImg, IonRefresher, IonRefresherContent, IonSpinner, IonText, ToastController } from '@ionic/angular/standalone';
import { Firestore, collection, doc, getDoc, getDocs, query, where, limit } from '@angular/fire/firestore';
import { RejectedProfilesService } from './data-access/rejected-profiles.service';
import { LikedProfilesService } from './data-access/iked-profiles.service';
import { ProfileVisibilityService, VisibilityType } from './data-access/profile-visibility.service';
import { UserActivityService } from '../shared/data-access/user-activity.service';

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
    IonCard, IonCardContent, IonAvatar, IonImg, IonText, IonButton, IonAlert, IonSpinner, IonRefresher, IonRefresherContent, IonContent, IonIcon
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
  private rejectedProfilesService = inject(RejectedProfilesService);
  private alertController = inject(AlertController);
  private toastController = inject(ToastController);
  private likedProfilesService = inject(LikedProfilesService);
  private userActivityService = inject(UserActivityService);

  recommendedUsers: any[] = [];
  loading = true;

  userData: userCreate | null = null;
  formData: formCreate | null = null;
  isFormComplete: boolean = true;
  showAlert: boolean = false;
  allPotentialMatches: any[] = []; // Almacenará todas las coincidencias potenciales
  batchSize: number = 5; // Número de recomendaciones a cargar por lote
  currentBatch: number = 1; // Control del lote actual
  isLoadingMore: boolean = false; // Control de estado de carga de más recomendaciones
  searchLimit: number = 5; // Cantidad de usuarios a buscar por colección en cada carga
  collectionsProcessed: number = 0; // Control de colecciones procesadas
  pendingCollections: string[] = []; // Colecciones pendientes de procesar

  rejectedProfiles: string[] = []; // IDs de perfiles rechazados
  likedProfiles: string[] = []; // IDs de perfiles con like

  isInGroup: boolean = false;
  groupMembers: string[] = [];

  userVisibility: VisibilityType = 'visible';


  constructor(
    private profileVisibilityService: ProfileVisibilityService,
  ) {
    this.profileVisibilityService.getProfileStatus()
    .subscribe((status: {visibility: VisibilityType}) => {
      // Solo guardar el estado de visibilidad, sin funcionalidad de grupos
      this.userVisibility = status.visibility;
    });
  }
  

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

  formatHorario(horario: string): string {
    const horarioMap: { [key: string]: string } = {
      'durante_almuerzo': 'Durante el almuerzo',
      'despues_clases': 'Después de clases',
      'manana_fines': 'Mañanas en fin de semana',
      'tarde_fines': 'Tardes en fin de semana'
    };

    return horarioMap[horario] || horario;
  }

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

          // Suscribirse a los perfiles rechazados
          this.rejectedProfilesService.getRejectedProfiles().subscribe(
            profiles => {
              this.rejectedProfiles = profiles;
              console.log('Perfiles rechazados cargados:', this.rejectedProfiles.length);
            }
          );

          // Suscribirse a los perfiles con like
          this.likedProfilesService.getLikedProfiles().subscribe(
            profiles => {
              this.likedProfiles = profiles;
              console.log('Perfiles con like cargados:', this.likedProfiles.length);
            }
          );

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

  // Función para normalizar el nombre de la carrera como aparece en Firestore
  private normalizeCarreraName(carrera: string): string {
    const carreraMap: { [key: string]: string } = {
      'informatica': 'Informatica',
      'ieme': 'IEME',
      'mcm': 'MCM',
      'ema': 'EMA',
      'mecatronica': 'Mecatronica',
      'ciencias': 'Ciencias'
    };

    return carreraMap[carrera.toLowerCase()] || carrera;
  }

  async startChat(otherUserId: string, otherUserName: string) {
    const currentUser = this.auth.currentUser;
    if (!currentUser) {
      console.error('No user logged in');
      return;
    }
  
    try {
      const chatId = await this.chatService.startChat(currentUser.uid, otherUserId);
      
      // Registrar inicio de chat como actividad importante
      this.userActivityService.registerActivity('start_chat');
      
      if (chatId) {
        this.router.navigate(['/menu/mensajes', chatId]);
      }
    } catch (error) {
      console.error('Error starting chat:', error);
    }
  }

  //Algoritmo de recomendaciones
  async loadRecommendations() {
    console.log("Comenzando búsqueda de recomendaciones para usuario:", this.userData);

    try {
      // Establecer a true solo aquí, al inicio del proceso
      this.loading = true;

      if (!this.formData || !this.userData) {
        console.error('Faltan datos del usuario o del formulario');
        this.loading = false;
        return;
      }

      // Limpiar datos existentes
      this.recommendedUsers = [];
      this.allPotentialMatches = [];
      this.currentBatch = 1;
      this.collectionsProcessed = 0;

      // Verificar que el año lectivo está disponible
      if (!this.userData.anioLectivo) {
        console.error('Falta año lectivo del usuario actual');
        this.loading = false;
        return;
      }

      const userAnioLectivo = this.userData.anioLectivo;
      console.log('Año lectivo del usuario actual:', userAnioLectivo);

      // Obtener carreras buscadas por el usuario
      const carrerasBuscadas = this.formData.carrera_buscada || [];
      console.log('Carreras buscadas:', carrerasBuscadas);

      // Si no hay carreras buscadas, no mostrar recomendaciones
      if (carrerasBuscadas.length === 0) {
        console.log('El usuario no ha seleccionado carreras para buscar');
        this.loading = false;
        return;
      }

      // Convertir las carreras buscadas a sus nombres normalizados
      const collectionsToSearch = carrerasBuscadas.map(carrera => this.normalizeCarreraName(carrera));
      console.log('Colecciones a buscar:', collectionsToSearch);

      // Guardar colecciones pendientes
      this.pendingCollections = [...collectionsToSearch];

      // Cargar el primer lote de colecciones
      // loadMoreCandidates se encargará de establecer loading = false
      await this.loadMoreCandidates();

    } catch (error) {
      console.error('Error al iniciar carga de recomendaciones:', error);
      this.loading = false;
    }
  }

  // Método para cargar candidatos por lotes (versión completa y corregida)
  async loadMoreCandidates() {
    if (this.pendingCollections.length === 0) {
      console.log('No hay más colecciones para buscar');
      this.loading = false; // Asegurar que se oculta el spinner
      return;
    }

    try {
      // Solo mostrar indicador de carga si no hay recomendaciones aún
      if (this.recommendedUsers.length === 0) {
        this.loading = true;
      }

      // Verificar usuario actual
      const currentUser = this.auth.currentUser;
      if (!currentUser) {
        console.error('No hay usuario autenticado');
        this.loading = false;
        return;
      }

      const currentUserId = currentUser.uid;

      // Verificar que userData existe
      if (!this.userData || !this.userData.anioLectivo) {
        console.error('Datos de usuario no disponibles');
        this.loading = false;
        return;
      }

      const userAnioLectivo = this.userData.anioLectivo;

      // Procesar una colección a la vez para mejor control
      const collectionName = this.pendingCollections.shift();
      if (!collectionName) {
        console.log('Nombre de colección no disponible');
        this.loading = false;
        return;
      }

      console.log(`Procesando colección: ${collectionName}`);

      const carreraCollection = collection(this.firestore, collectionName);

      // Consulta limitada para mejor rendimiento
      const q = query(
        carreraCollection,
        where('uid', '!=', currentUserId),
        limit(this.searchLimit)
      );

      const querySnapshot = await getDocs(q);
      console.log(`Encontrados ${querySnapshot.docs.length} documentos en ${collectionName}`);

      // Procesar los documentos encontrados
      let newCandidatesCount = 0;
      const candidatesInCollection: any[] = [];

      for (const docSnap of querySnapshot.docs) {
        // Obtener la información general del usuario
        const userGeneralDoc = await getDoc(doc(this.firestore, 'usuarios', docSnap.id));
        const userData = userGeneralDoc.data();

        if (this.rejectedProfiles.includes(docSnap.id) || this.likedProfiles.includes(docSnap.id)) {
          console.log(`Descartando - Perfil rechazado o con like: ${docSnap.id}`);
          continue;
        }

        const visibilityRef = doc(this.firestore, 'profileVisibility', docSnap.id);
        const visibilitySnap = await getDoc(visibilityRef);

        if (visibilitySnap.exists() && visibilitySnap.data()?.['visibility'] === 'invisible') {
          console.log(`Descartando - Perfil invisible: ${docSnap.id}`);
          continue;
        }

        const isInGroup = visibilitySnap.exists() &&
          visibilitySnap.data()?.['visibility'] === 'visible_in_group';
        const groupMembers = isInGroup ? visibilitySnap.data()?.['groupMembers'] || [] : [];

        if (!userData) {
          console.log(`Sin datos para usuario ${docSnap.id}`);
          continue;
        }

        // Verificar si este perfil ya ha sido rechazado
        if (this.rejectedProfiles.includes(docSnap.id) || this.likedProfiles.includes(docSnap.id)) {
          console.log(`Descartando - Perfil rechazado o con like: ${docSnap.id}`);
          continue;
        }

        const formCompleted = userData['formCompleted'] ?? false;

        // Solo considerar usuarios que hayan completado el formulario
        if (formCompleted) {
          const userFormData = docSnap.data();

          // Obtener el año lectivo y la carrera
          const otherUserData = await this.registerService.getUserData(docSnap.id);
          const otherUserYear = otherUserData?.anioLectivo;
          const userCarrera = userData['carrera'];

          // FILTRO CRÍTICO: Verificar que sean del mismo año lectivo
          if (otherUserYear !== userAnioLectivo) {
            console.log(`Descartando - Año diferente: ${otherUserYear} vs ${userAnioLectivo}`);
            continue;
          }

          // Calcular puntuación para poder ordenar por calidad
          if (userFormData && userCarrera) {
            const matchDetails = this.calculateDetailedMatchScore(userFormData, userCarrera);

            candidatesInCollection.push({
              uid: docSnap.id,
              nombreUsuario: userFormData['nombreUsuario'] || 'Usuario',
              nombre: userFormData['nombre'] || '',
              apellido: userFormData['apellido'] || '',
              carrera: userCarrera || '',
              anioLectivo: otherUserYear || '',
              mencion: userFormData['mencion'] || '',
              paralelo: userFormData['paralelo'] || '',
              isInGroup: isInGroup,               // ← Añadir esto
              groupMembers: groupMembers,         // ← Añadir esto
              ...userFormData,
              matchScore: matchDetails.totalScore,
              skillScore: matchDetails.skillScore,
              otherScore: matchDetails.otherScore
            });

            newCandidatesCount++;
          }
        } else {
          console.log(`Descartando - Formulario no completado`);
        }
      }

      // Agregar al pool de candidatos potenciales
      this.allPotentialMatches = [...this.allPotentialMatches, ...candidatesInCollection];
      this.collectionsProcessed++;

      console.log(`Procesados ${newCandidatesCount} nuevos candidatos de ${collectionName}`);
      console.log(`Total de candidatos acumulados: ${this.allPotentialMatches.length}`);

      // Ordenar todos los candidatos por puntuación
      this.allPotentialMatches.sort((a, b) => {
        // Primero ordenar por coincidencia de habilidades
        if (b.skillScore !== a.skillScore) {
          return b.skillScore - a.skillScore;
        }
        // En caso de empate, usar la puntuación total
        return b.matchScore - a.matchScore;
      });

      // Si no hay recomendaciones cargadas aún, cargar el primer lote visual
      if (this.recommendedUsers.length === 0) {
        await this.loadNextBatch();
        // Ocultar el spinner principal después de cargar el primer lote
        this.loading = false;
      }

      // Si los candidatos son pocos, cargar más automáticamente
      if (this.allPotentialMatches.length < 10 && this.pendingCollections.length > 0) {
        console.log('Pocos candidatos, buscando en más colecciones...');
        // No activar el spinner principal para cargas adicionales
        const wasLoading = this.loading;
        this.loading = false; // Asegurar que el spinner principal está oculto
        await this.loadMoreCandidates();
      }

    } catch (error) {
      console.error('Error al cargar candidatos:', error);
      this.loading = false;
    } finally {
      // Ocultar el spinner al finalizar
      this.loading = false;
    }
  }

  // Función principal de cálculo de compatibilidad (simplificada)
  private calculateMatchScore(otherUserData: any, otherUserCarrera: string): number {
    if (!this.formData || !otherUserData) return 0;

    let matchScore = 0;
    console.log(`Calculando puntuación para usuario con carrera: ${otherUserCarrera}`);

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
      console.log(`+30 puntos por carrera buscada: ${normalizedCarrera}`);
    } else {
      console.log(`Carrera no está entre las buscadas: ${normalizedCarrera}`);
    }

    // 2. Compatibilidad de horarios
    if (this.formData.horario && otherUserData.horario) {
      const commonSchedules = this.formData.horario.filter(
        horario => otherUserData.horario?.includes(horario)
      );
      matchScore += commonSchedules.length * 5;
      console.log(`+${commonSchedules.length * 5} puntos por ${commonSchedules.length} horarios compatibles`);
    } else {
      console.log('No se pudo evaluar compatibilidad de horarios');
    }

    // 3. Compatibilidad de método de trabajo
    if (this.formData.metodo && otherUserData.metodo) {
      if (this.formData.metodo === otherUserData.metodo ||
        this.formData.metodo === 'ambos' ||
        otherUserData.metodo === 'ambos') {
        matchScore += 10;
        console.log(`+10 puntos por método de trabajo compatible: ${this.formData.metodo} vs ${otherUserData.metodo}`);
      } else {
        console.log(`Métodos de trabajo incompatibles: ${this.formData.metodo} vs ${otherUserData.metodo}`);
      }
    } else {
      console.log('No se pudo evaluar compatibilidad de método de trabajo');
    }

    // 4. Compatibilidad de horas
    if (this.formData.horas && otherUserData.horas) {
      if (this.formData.horas === otherUserData.horas ||
        this.formData.horas === 'flexible' ||
        otherUserData.horas === 'flexible') {
        matchScore += 5;
        console.log(`+5 puntos por horas compatibles: ${this.formData.horas} vs ${otherUserData.horas}`);
      } else {
        console.log(`Horas incompatibles: ${this.formData.horas} vs ${otherUserData.horas}`);
      }
    } else {
      console.log('No se pudo evaluar compatibilidad de horas');
    }

    // 5. Evaluar match de habilidades (lo más importante)
    const skillScore = this.evaluateSkillsMatch(otherUserData, otherUserCarrera);
    matchScore += skillScore;

    console.log(`Puntuación final de compatibilidad: ${matchScore}`);
    return matchScore;
  }

  private evaluateSkillsMatch(otherUserData: any, otherUserCarrera: string): number {
    if (!this.formData || !this.userData) return 0;

    // Verificamos que el año lectivo está definido
    if (!this.userData.anioLectivo) {
      console.log('No se puede evaluar skills sin año lectivo definido');
      return 0;
    }

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
      console.log(`Evaluando habilidades para carrera: ${otherUserCarrera}`);

      // Determinamos el año lectivo del usuario actual para evaluación de habilidades
      const userAnioLectivo = this.userData.anioLectivo;

      // Evaluar habilidades según el año lectivo
      if (userAnioLectivo === 'Tercero') {
        // Lógica para evaluar habilidades de tercero
        console.log('Evaluando habilidades para Tercero');
        return this.evaluateTerceroSkills(otherUserData, otherUserCarrera);
      } else if (userAnioLectivo === 'Segundo') {
        // Lógica para evaluar habilidades de segundo
        console.log('Evaluando habilidades para Segundo');
        return this.evaluateSegundoSkills(otherUserData, otherUserCarrera);
      } else {
        console.log(`Año lectivo no reconocido: ${userAnioLectivo}`);
      }
    } else {
      console.log(`La carrera ${otherUserCarrera} (${otherUserCarreraAlias}) no está entre las buscadas por el usuario`);
    }

    return skillMatchScore;
  }

  // Evaluar habilidades específicas para estudiantes de tercero
  private evaluateTerceroSkills(otherUserData: any, otherUserCarrera: string): number {
    if (!this.formData) return 0;

    let skillMatchScore = 0;
    const valorHabilidad = { 'Alto': 3, 'Medio': 2, 'Bajo': 1 };

    // Según la carrera, verificar las habilidades correspondientes
    switch (otherUserCarrera) {
      case 'Informatica':
        if (this.formData.habilidad_buscada_ter?.informatica_ter && otherUserData.habilidad_ofrecida_ter?.informatica_ter_of) {
          console.log('Evaluando habilidades de Informática (Tercero)');
          const habilidades = [
            'programacion', 'diseno', 'cad', 'soporte', 'movil', 'web', 'redes'
          ];

          for (const hab of habilidades) {
            const valorBuscado = this.formData.habilidad_buscada_ter.informatica_ter[hab as keyof typeof this.formData.habilidad_buscada_ter.informatica_ter];
            const valorOfrecido = otherUserData.habilidad_ofrecida_ter.informatica_ter_of[hab as keyof typeof otherUserData.habilidad_ofrecida_ter.informatica_ter_of];

            if (valorBuscado && valorOfrecido) {
              console.log(`Habilidad ${hab}: Buscado=${valorBuscado}, Ofrecido=${valorOfrecido}`);
              if (valorHabilidad[valorOfrecido as keyof typeof valorHabilidad] >=
                valorHabilidad[valorBuscado as keyof typeof valorHabilidad]) {
                skillMatchScore += 5;
                console.log(`¡Match! +5 puntos para ${hab}`);
              }
            }
          }
        } else {
          console.log('Faltan datos de habilidades para Informática (Tercero)');
        }
        break;

      case 'IEME':
        if (this.formData.habilidad_buscada_ter?.ieme_ter && otherUserData.habilidad_ofrecida_ter?.ieme_ter_of) {
          console.log('Evaluando habilidades de IEME (Tercero)');
          const habilidades = [
            'electrotecnia', 'instalaciones', 'electronica', 'potencia',
            'maquinas', 'industrial', 'electronicaAplicada', 'comunicaciones'
          ];

          for (const hab of habilidades) {
            const valorBuscado = this.formData.habilidad_buscada_ter.ieme_ter[hab as keyof typeof this.formData.habilidad_buscada_ter.ieme_ter];
            const valorOfrecido = otherUserData.habilidad_ofrecida_ter.ieme_ter_of[hab as keyof typeof otherUserData.habilidad_ofrecida_ter.ieme_ter_of];

            if (valorBuscado && valorOfrecido) {
              console.log(`Habilidad ${hab}: Buscado=${valorBuscado}, Ofrecido=${valorOfrecido}`);
              if (valorHabilidad[valorOfrecido as keyof typeof valorHabilidad] >=
                valorHabilidad[valorBuscado as keyof typeof valorHabilidad]) {
                skillMatchScore += 5;
                console.log(`¡Match! +5 puntos para ${hab}`);
              }
            }
          }
        } else {
          console.log('Faltan datos de habilidades para IEME (Tercero)');
        }
        break;

      case 'MCM':
        if (this.formData.habilidad_buscada_ter?.mcm_ter && otherUserData.habilidad_ofrecida_ter?.mcm_ter_of) {
          console.log('Evaluando habilidades de MCM (Tercero)');
          const habilidades = [
            'metrologia', 'metalurgia', 'soldaduraMcm', 'fabricacion',
            'dibujoMcm', 'automatizacionMcm', 'maquinasMcm', 'moldes'
          ];

          for (const hab of habilidades) {
            const valorBuscado = this.formData.habilidad_buscada_ter.mcm_ter[hab as keyof typeof this.formData.habilidad_buscada_ter.mcm_ter];
            const valorOfrecido = otherUserData.habilidad_ofrecida_ter.mcm_ter_of[hab as keyof typeof otherUserData.habilidad_ofrecida_ter.mcm_ter_of];

            if (valorBuscado && valorOfrecido) {
              console.log(`Habilidad ${hab}: Buscado=${valorBuscado}, Ofrecido=${valorOfrecido}`);
              if (valorHabilidad[valorOfrecido as keyof typeof valorHabilidad] >=
                valorHabilidad[valorBuscado as keyof typeof valorHabilidad]) {
                skillMatchScore += 5;
                console.log(`¡Match! +5 puntos para ${hab}`);
              }
            }
          }
        } else {
          console.log('Faltan datos de habilidades para MCM (Tercero)');
        }
        break;

      case 'EMA':
        if (this.formData.habilidad_buscada_ter?.ema_ter && otherUserData.habilidad_ofrecida_ter?.ema_ter_of) {
          console.log('Evaluando habilidades de EMA (Tercero)');
          const habilidades = [
            'motores', 'sistemasElectronicos', 'sistemasElectricos', 'dibujoEma',
            'mantenimiento', 'automotriz', 'seguridad'
          ];

          for (const hab of habilidades) {
            const valorBuscado = this.formData.habilidad_buscada_ter.ema_ter[hab as keyof typeof this.formData.habilidad_buscada_ter.ema_ter];
            const valorOfrecido = otherUserData.habilidad_ofrecida_ter.ema_ter_of[hab as keyof typeof otherUserData.habilidad_ofrecida_ter.ema_ter_of];

            if (valorBuscado && valorOfrecido) {
              console.log(`Habilidad ${hab}: Buscado=${valorBuscado}, Ofrecido=${valorOfrecido}`);
              if (valorHabilidad[valorOfrecido as keyof typeof valorHabilidad] >=
                valorHabilidad[valorBuscado as keyof typeof valorHabilidad]) {
                skillMatchScore += 5;
                console.log(`¡Match! +5 puntos para ${hab}`);
              }
            }
          }
        } else {
          console.log('Faltan datos de habilidades para EMA (Tercero)');
        }
        break;

      case 'Mecatronica':
        if (this.formData.habilidad_buscada_ter?.mecatronica_ter && otherUserData.habilidad_ofrecida_ter?.mec_ter_of) {
          console.log('Evaluando habilidades de Mecatrónica (Tercero)');
          const habilidades = [
            'microcontroladores', 'servomecanismos', 'automatizacion', 'dibujoMec',
            'simulacion', 'programacionMec', 'soldadura', 'manufactura', 'cnc'
          ];

          for (const hab of habilidades) {
            const valorBuscado = this.formData.habilidad_buscada_ter.mecatronica_ter[hab as keyof typeof this.formData.habilidad_buscada_ter.mecatronica_ter];
            const valorOfrecido = otherUserData.habilidad_ofrecida_ter.mec_ter_of[hab as keyof typeof otherUserData.habilidad_ofrecida_ter.mec_ter_of];

            if (valorBuscado && valorOfrecido) {
              console.log(`Habilidad ${hab}: Buscado=${valorBuscado}, Ofrecido=${valorOfrecido}`);
              if (valorHabilidad[valorOfrecido as keyof typeof valorHabilidad] >=
                valorHabilidad[valorBuscado as keyof typeof valorHabilidad]) {
                skillMatchScore += 5;
                console.log(`¡Match! +5 puntos para ${hab}`);
              }
            }
          }
        } else {
          console.log('Faltan datos de habilidades para Mecatrónica (Tercero)');
        }
        break;

      case 'Ciencias':
        if (this.formData.habilidad_buscada_ter?.ciecias_ter && otherUserData.habilidad_ofrecida_ter?.ciencias_ter_of) {
          console.log('Evaluando habilidades de Ciencias (Tercero)');
          const habilidades = [
            'redaccionCreativa', 'dibujoCiencias', 'investigacion', 'biologia',
            'morfologia', 'sociologia', 'politica', 'matematica', 'fisica'
          ];

          for (const hab of habilidades) {
            const valorBuscado = this.formData.habilidad_buscada_ter.ciecias_ter[hab as keyof typeof this.formData.habilidad_buscada_ter.ciecias_ter];
            const valorOfrecido = otherUserData.habilidad_ofrecida_ter.ciencias_ter_of[hab as keyof typeof otherUserData.habilidad_ofrecida_ter.ciencias_ter_of];

            if (valorBuscado && valorOfrecido) {
              console.log(`Habilidad ${hab}: Buscado=${valorBuscado}, Ofrecido=${valorOfrecido}`);
              if (valorHabilidad[valorOfrecido as keyof typeof valorHabilidad] >=
                valorHabilidad[valorBuscado as keyof typeof valorHabilidad]) {
                skillMatchScore += 5;
                console.log(`¡Match! +5 puntos para ${hab}`);
              }
            }
          }
        } else {
          console.log('Faltan datos de habilidades para Ciencias (Tercero)');
        }
        break;
    }

    console.log(`Puntuación final de habilidades para Tercero: ${skillMatchScore}`);
    return skillMatchScore;
  }

  // Evaluar habilidades específicas para estudiantes de segundo
  private evaluateSegundoSkills(otherUserData: any, otherUserCarrera: string): number {
    if (!this.formData) return 0;

    let skillMatchScore = 0;
    const valorHabilidad = { 'Alto': 3, 'Medio': 2, 'Bajo': 1 };

    // Según la carrera, verificar las habilidades correspondientes
    switch (otherUserCarrera) {
      case 'Informatica':
        if (this.formData.habilidad_buscada_seg?.informatica_seg && otherUserData.habilidad_ofrecida_seg?.informatica_seg_of) {
          console.log('Evaluando habilidades de Informática (Segundo)');
          const habilidades = ['programacion', 'soporte', 'web', 'redes'];

          for (const hab of habilidades) {
            const valorBuscado = this.formData.habilidad_buscada_seg.informatica_seg[hab as keyof typeof this.formData.habilidad_buscada_seg.informatica_seg];
            const valorOfrecido = otherUserData.habilidad_ofrecida_seg.informatica_seg_of[hab as keyof typeof otherUserData.habilidad_ofrecida_seg.informatica_seg_of];

            if (valorBuscado && valorOfrecido) {
              console.log(`Habilidad ${hab}: Buscado=${valorBuscado}, Ofrecido=${valorOfrecido}`);
              if (valorHabilidad[valorOfrecido as keyof typeof valorHabilidad] >=
                valorHabilidad[valorBuscado as keyof typeof valorHabilidad]) {
                skillMatchScore += 5;
                console.log(`¡Match! +5 puntos para ${hab}`);
              }
            }
          }
        } else {
          console.log('Faltan datos de habilidades para Informática (Segundo)');
        }
        break;

      case 'IEME':
        if (this.formData.habilidad_buscada_seg?.ieme_seg && otherUserData.habilidad_ofrecida_seg?.ieme_seg_of) {
          console.log('Evaluando habilidades de IEME (Segundo)');
          const habilidades = [
            'instalacionesSeg', 'electricidadSeg', 'electronicaSeg', 'automatizacionSeg'
          ];

          for (const hab of habilidades) {
            const valorBuscado = this.formData.habilidad_buscada_seg.ieme_seg[hab as keyof typeof this.formData.habilidad_buscada_seg.ieme_seg];
            const valorOfrecido = otherUserData.habilidad_ofrecida_seg.ieme_seg_of[hab as keyof typeof otherUserData.habilidad_ofrecida_seg.ieme_seg_of];

            if (valorBuscado && valorOfrecido) {
              console.log(`Habilidad ${hab}: Buscado=${valorBuscado}, Ofrecido=${valorOfrecido}`);
              if (valorHabilidad[valorOfrecido as keyof typeof valorHabilidad] >=
                valorHabilidad[valorBuscado as keyof typeof valorHabilidad]) {
                skillMatchScore += 5;
                console.log(`¡Match! +5 puntos para ${hab}`);
              }
            }
          }
        } else {
          console.log('Faltan datos de habilidades para IEME (Segundo)');
        }
        break;

      case 'MCM':
        if (this.formData.habilidad_buscada_seg?.mcm_seg && otherUserData.habilidad_ofrecida_seg?.mcm_seg_of) {
          console.log('Evaluando habilidades de MCM (Segundo)');
          const habilidades = [
            'soldaduraMcmSeg', 'fresadoraSeg', 'tornoSeg', 'dibujoMcmSeg'
          ];

          for (const hab of habilidades) {
            const valorBuscado = this.formData.habilidad_buscada_seg.mcm_seg[hab as keyof typeof this.formData.habilidad_buscada_seg.mcm_seg];
            const valorOfrecido = otherUserData.habilidad_ofrecida_seg.mcm_seg_of[hab as keyof typeof otherUserData.habilidad_ofrecida_seg.mcm_seg_of];

            if (valorBuscado && valorOfrecido) {
              console.log(`Habilidad ${hab}: Buscado=${valorBuscado}, Ofrecido=${valorOfrecido}`);
              if (valorHabilidad[valorOfrecido as keyof typeof valorHabilidad] >=
                valorHabilidad[valorBuscado as keyof typeof valorHabilidad]) {
                skillMatchScore += 5;
                console.log(`¡Match! +5 puntos para ${hab}`);
              }
            }
          }
        } else {
          console.log('Faltan datos de habilidades para MCM (Segundo)');
        }
        break;

      case 'EMA':
        if (this.formData.habilidad_buscada_seg?.ema_seg && otherUserData.habilidad_ofrecida_seg?.ema_seg_of) {
          console.log('Evaluando habilidades de EMA (Segundo)');
          const habilidades = [
            'sistemasSeg', 'electronicaSeg', 'mantenimientoSeg'
          ];

          for (const hab of habilidades) {
            const valorBuscado = this.formData.habilidad_buscada_seg.ema_seg[hab as keyof typeof this.formData.habilidad_buscada_seg.ema_seg];
            const valorOfrecido = otherUserData.habilidad_ofrecida_seg.ema_seg_of[hab as keyof typeof otherUserData.habilidad_ofrecida_seg.ema_seg_of];

            if (valorBuscado && valorOfrecido) {
              console.log(`Habilidad ${hab}: Buscado=${valorBuscado}, Ofrecido=${valorOfrecido}`);
              if (valorHabilidad[valorOfrecido as keyof typeof valorHabilidad] >=
                valorHabilidad[valorBuscado as keyof typeof valorHabilidad]) {
                skillMatchScore += 5;
                console.log(`¡Match! +5 puntos para ${hab}`);
              }
            }
          }
        } else {
          console.log('Faltan datos de habilidades para EMA (Segundo)');
        }
        break;

      case 'Mecatronica':
        if (this.formData.habilidad_buscada_seg?.mec_seg && otherUserData.habilidad_ofrecida_seg?.mec_seg_of) {
          console.log('Evaluando habilidades de Mecatrónica (Segundo)');
          const habilidades = [
            'electronicaDigital', 'cncMecSeg', 'manufacturaMecSeg', 'automatizacionMecSeg'
          ];

          for (const hab of habilidades) {
            const valorBuscado = this.formData.habilidad_buscada_seg.mec_seg[hab as keyof typeof this.formData.habilidad_buscada_seg.mec_seg];
            const valorOfrecido = otherUserData.habilidad_ofrecida_seg.mec_seg_of[hab as keyof typeof otherUserData.habilidad_ofrecida_seg.mec_seg_of];

            if (valorBuscado && valorOfrecido) {
              console.log(`Habilidad ${hab}: Buscado=${valorBuscado}, Ofrecido=${valorOfrecido}`);
              if (valorHabilidad[valorOfrecido as keyof typeof valorHabilidad] >=
                valorHabilidad[valorBuscado as keyof typeof valorHabilidad]) {
                skillMatchScore += 5;
                console.log(`¡Match! +5 puntos para ${hab}`);
              }
            }
          }
        } else {
          console.log('Faltan datos de habilidades para Mecatrónica (Segundo)');
        }
        break;

      case 'Ciencias':
        if (this.formData.habilidad_buscada_seg?.ciencias_seg && otherUserData.habilidad_ofrecida_seg?.ciencias_seg_of) {
          console.log('Evaluando habilidades de Ciencias (Segundo)');
          const habilidades = [
            'laboratorio', 'psicologia', 'redaccionCreativaSeg'
          ];

          for (const hab of habilidades) {
            const valorBuscado = this.formData.habilidad_buscada_seg.ciencias_seg[hab as keyof typeof this.formData.habilidad_buscada_seg.ciencias_seg];
            const valorOfrecido = otherUserData.habilidad_ofrecida_seg.ciencias_seg_of[hab as keyof typeof otherUserData.habilidad_ofrecida_seg.ciencias_seg_of];

            if (valorBuscado && valorOfrecido) {
              console.log(`Habilidad ${hab}: Buscado=${valorBuscado}, Ofrecido=${valorOfrecido}`);
              if (valorHabilidad[valorOfrecido as keyof typeof valorHabilidad] >=
                valorHabilidad[valorBuscado as keyof typeof valorHabilidad]) {
                skillMatchScore += 5;
                console.log(`¡Match! +5 puntos para ${hab}`);
              }
            }
          }
        } else {
          console.log('Faltan datos de habilidades para Ciencias (Segundo)');
        }
        break;
    }

    console.log(`Puntuación final de habilidades para Segundo: ${skillMatchScore}`);
    return skillMatchScore;
  }

  private calculateDetailedMatchScore(otherUserData: any, otherUserCarrera: string): {
    totalScore: number,
    skillScore: number,
    otherScore: number
  } {
    if (!this.formData || !otherUserData) return { totalScore: 0, skillScore: 0, otherScore: 0 };

    let otherScore = 0;
    console.log(`Calculando puntuación para usuario con carrera: ${otherUserCarrera}`);

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
      otherScore += 30; // Gran peso a coincidir con carreras buscadas
      console.log(`+30 puntos por carrera buscada: ${normalizedCarrera}`);
    } else {
      console.log(`Carrera no está entre las buscadas: ${normalizedCarrera}`);
    }

    // 2. Compatibilidad de horarios
    if (this.formData.horario && otherUserData.horario) {
      const commonSchedules = this.formData.horario.filter(
        horario => otherUserData.horario?.includes(horario)
      );
      otherScore += commonSchedules.length * 5;
      console.log(`+${commonSchedules.length * 5} puntos por ${commonSchedules.length} horarios compatibles`);
    } else {
      console.log('No se pudo evaluar compatibilidad de horarios');
    }

    // 3. Compatibilidad de método de trabajo
    if (this.formData.metodo && otherUserData.metodo) {
      if (this.formData.metodo === otherUserData.metodo ||
        this.formData.metodo === 'ambos' ||
        otherUserData.metodo === 'ambos') {
        otherScore += 10;
        console.log(`+10 puntos por método de trabajo compatible: ${this.formData.metodo} vs ${otherUserData.metodo}`);
      } else {
        console.log(`Métodos de trabajo incompatibles: ${this.formData.metodo} vs ${otherUserData.metodo}`);
      }
    } else {
      console.log('No se pudo evaluar compatibilidad de método de trabajo');
    }

    // 4. Compatibilidad de horas
    if (this.formData.horas && otherUserData.horas) {
      if (this.formData.horas === otherUserData.horas ||
        this.formData.horas === 'flexible' ||
        otherUserData.horas === 'flexible') {
        otherScore += 5;
        console.log(`+5 puntos por horas compatibles: ${this.formData.horas} vs ${otherUserData.horas}`);
      } else {
        console.log(`Horas incompatibles: ${this.formData.horas} vs ${otherUserData.horas}`);
      }
    } else {
      console.log('No se pudo evaluar compatibilidad de horas');
    }

    // 5. Evaluar match de habilidades (lo más importante)
    const skillScore = this.evaluateSkillsMatch(otherUserData, otherUserCarrera);

    // Calcular puntuación total
    const totalScore = otherScore + skillScore;

    console.log(`Puntuación detallada: Total=${totalScore}, Habilidades=${skillScore}, Otros=${otherScore}`);
    return { totalScore, skillScore, otherScore };
  }

  async handleRefresh(event?: any) {
    console.log('Comenzando operación de actualización');

    try {
      // Reiniciar estados
      this.loading = true;
      this.recommendedUsers = [];
      this.allPotentialMatches = [];
      this.currentBatch = 1;
      this.collectionsProcessed = 0;
      this.pendingCollections = [];

      const user = this.auth.currentUser;
      if (user) {
        // Recargar datos de ambos servicios
        const [registerData, formData, formCompleted] = await Promise.all([
          this.registerService.getUserData(user.uid),
          this.formService.getFormData(user.uid),
          this.formStateService.checkFormCompletion(user.uid)
        ]);

        this.userData = registerData;
        this.formData = formData;
        this.isFormComplete = formCompleted;

        // Cargar recomendaciones solo si el formulario está completo
        if (formCompleted && this.userData && this.formData) {
          await this.loadRecommendations();

          // Después de cargar las recomendaciones, reiniciar el swiper a la primera diapositiva
          setTimeout(() => {
            const swiperEl = document.querySelector('swiper-container');
            if (swiperEl && swiperEl.swiper) {
              swiperEl.swiper.slideTo(0, 0); // Ir a la primera diapositiva sin animación
            }
          }, 100);
        }
      }
    } catch (error) {
      console.error('Error al actualizar datos:', error);
    } finally {
      // Completar el evento de actualización si existe
      if (event && event.target && event.target.complete) {
        event.target.complete();
      }
      this.loading = false;
    }
  }

  // Método para detectar cambios de diapositiva
  onSlideChange(event: any) {
    // Comprobar que el evento es válido
    if (!event || !event.target) return;

    // Obtener el swiper
    const swiperEl = event.target;
    if (!swiperEl || !swiperEl.swiper) return;

    // Obtener el índice de la diapositiva actual
    const currentIndex = swiperEl.swiper.realIndex;
    if (typeof currentIndex !== 'number') return;

    const totalSlides = this.recommendedUsers.length;

    console.log(`Cambio de slide: ${currentIndex}/${totalSlides}, candidatos disponibles: ${this.allPotentialMatches.length}, colecciones pendientes: ${this.pendingCollections.length}`);

    // Si el usuario está cerca del final, cargar el siguiente lote visual
    if (currentIndex >= totalSlides - 2 && !this.isLoadingMore &&
      this.allPotentialMatches.length > this.recommendedUsers.length) {
      console.log('Usuario cerca del final, cargando más tarjetas...');
      this.loadNextBatch();
    }

    // Si estamos llegando al final de los candidatos disponibles y hay más colecciones,
    // comenzar a cargar más candidatos en segundo plano
    if (currentIndex >= totalSlides - 3 &&
      this.allPotentialMatches.length - this.recommendedUsers.length < this.batchSize &&
      this.pendingCollections.length > 0 && !this.loading) {
      console.log('Anticipando necesidad de más candidatos, cargando en segundo plano...');
      setTimeout(() => {
        this.loadMoreCandidates();
      }, 200);
    }

    // Comprobar si es la última diapositiva disponible actualmente
    if (currentIndex === totalSlides - 1) {
      console.log('Usuario ha llegado al final de las recomendaciones cargadas');
    }
  }

  async loadNextBatch() {
    try {
      if (this.isLoadingMore) return;
      this.isLoadingMore = true;

      console.log(`Cargando lote ${this.currentBatch} de recomendaciones...`);

      // Verificar si hay suficientes candidatos, si no, cargar más
      if (this.allPotentialMatches.length <= this.recommendedUsers.length + this.batchSize / 2 &&
        this.pendingCollections.length > 0) {
        console.log('Buscando más candidatos para futuros lotes...');
        // Ocultar el spinner principal mientras cargamos más candidatos
        this.loading = false;
        setTimeout(() => {
          this.loadMoreCandidates();
        }, 100);
      }

      // Calcular el índice de inicio para el lote actual
      const startIndex = this.recommendedUsers.length;

      // Si ya hemos cargado todas las recomendaciones, no hacer nada
      if (startIndex >= this.allPotentialMatches.length) {
        console.log('No quedan más recomendaciones para mostrar');
        this.isLoadingMore = false;
        this.loading = false; // Asegurar que el spinner principal está oculto
        return;
      }

      // Dar tiempo para que se muestre el indicador de carga
      await new Promise(resolve => setTimeout(resolve, 300));

      // Obtener el siguiente lote
      const endIndex = Math.min(startIndex + this.batchSize, this.allPotentialMatches.length);
      const nextBatch = this.allPotentialMatches.slice(startIndex, endIndex);

      console.log(`Añadiendo lote visual desde índice ${startIndex} hasta ${endIndex - 1}`);
      console.log(`Tamaño del lote: ${nextBatch.length}`);

      // Añadir el nuevo lote a las recomendaciones mostradas
      this.recommendedUsers = [...this.recommendedUsers, ...nextBatch];

      // Incrementar el contador de lotes
      this.currentBatch++;

      console.log(`Recomendaciones mostradas: ${this.recommendedUsers.length} de ${this.allPotentialMatches.length} disponibles`);

      // Si ya tenemos recomendaciones, ocultar el spinner principal
      if (this.recommendedUsers.length > 0) {
        this.loading = false;
      }
    } catch (error) {
      console.error('Error al cargar el siguiente lote visual:', error);
    } finally {
      setTimeout(() => {
        this.isLoadingMore = false;
        this.loading = false; // Asegurar que el spinner principal está oculto
      }, 500);
    }
  }

  async rejectProfile(user: any) {
    if (!user || !user.uid) {
      console.error('ID de usuario no válido para rechazar');
      return;
    }

  try {
    // 1. Obtener la tarjeta actual para animar
    const swiperEl = document.querySelector('swiper-container');
    if (!swiperEl || !swiperEl.swiper) return;

    const activeIndex = swiperEl.swiper.activeIndex;
    const activeSlide = swiperEl.querySelectorAll('swiper-slide')[activeIndex];
    if (!activeSlide) return;

    const card = activeSlide.querySelector('ion-card');
    if (!card) return;

    // 2. Aplicar clase de animación
    activeSlide.classList.add('animating');
    card.classList.add('profile-rejected');

    // 3. Rechazar en Firebase mientras se reproduce la animación
    this.rejectedProfilesService.rejectProfile(user.uid);
    
    // 4. Registrar la actividad de rechazo
    this.userActivityService.registerActivity('profile_reject');

    // 5. Esperar a que termine la animación
    await new Promise(resolve => setTimeout(resolve, 500));
  
      // 6. Eliminar el usuario de las recomendaciones
      this.recommendedUsers = this.recommendedUsers.filter(u => u.uid !== user.uid);
      this.allPotentialMatches = this.allPotentialMatches.filter(u => u.uid !== user.uid);
  
      // 7. Gestionar el estado después de eliminar
      if (this.recommendedUsers.length === 0 && this.allPotentialMatches.length > 0) {
        // Si no quedan recomendaciones mostradas pero hay más disponibles
        await this.loadNextBatch();
      } else if (this.recommendedUsers.length === 0) {
        // Si no hay más recomendaciones en absoluto
        this.loading = false;
      } else {
        // Ajustar el swiper si es necesario
        if (swiperEl.swiper.activeIndex >= this.recommendedUsers.length) {
          swiperEl.swiper.slideTo(this.recommendedUsers.length - 1);
        } else {
          // Forzar actualización del swiper
          swiperEl.swiper.update();
        }
      }
  
      // Opcional: mostrar un toast muy breve
      const toast = await this.toastController.create({
        message: 'Perfil rechazado',
        duration: 1000,
        position: 'bottom',
        color: 'medium',
        cssClass: 'reject-toast'
      });
      await toast.present();
  
    } catch (error) {
      console.error('Error al rechazar perfil:', error);
      this.presentToast('Error al rechazar perfil', 'danger');
    }
  }

  async presentToast(message: string, color: string = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
      color,
      buttons: [
        {
          text: 'Cerrar',
          role: 'cancel'
        }
      ]
    });

    await toast.present();
  }

  async likeProfile(user: any) {
    if (!user || !user.uid) {
      console.error('ID de usuario no válido para dar like');
      return;
    }  

    try {
      // 1. Obtener la tarjeta actual para animar
      const swiperEl = document.querySelector('swiper-container');
      if (!swiperEl || !swiperEl.swiper) return;
  
      const activeIndex = swiperEl.swiper.activeIndex;
      const activeSlide = swiperEl.querySelectorAll('swiper-slide')[activeIndex];
      if (!activeSlide) return;
  
      const card = activeSlide.querySelector('ion-card');
      if (!card) return;
  
      // 2. Aplicar clase de animación
      activeSlide.classList.add('animating');
      card.classList.add('profile-liked');
  
      // 3. Registrar el like en Firebase mientras se reproduce la animación
      this.likedProfilesService.likeProfile(user.uid);
      
      // 4. Registrar la actividad de dar like
      this.userActivityService.registerActivity('profile_like');
  
      // 5. Esperar a que termine la animación
      await new Promise(resolve => setTimeout(resolve, 500));

      // 6. Gestionar el estado después de eliminar
      if (this.recommendedUsers.length === 0 && this.allPotentialMatches.length > 0) {
        // Si no quedan recomendaciones mostradas pero hay más disponibles
        await this.loadNextBatch();
      } else if (this.recommendedUsers.length === 0) {
        // Si no hay más recomendaciones en absoluto
        this.loading = false;
      } else {
        // Ajustar el swiper si es necesario
        if (swiperEl.swiper.activeIndex >= this.recommendedUsers.length) {
          swiperEl.swiper.slideTo(this.recommendedUsers.length - 1);
        } else {
          // Forzar actualización del swiper
          swiperEl.swiper.update();
        }
      }

      // Mostrar un toast breve
      const toast = await this.toastController.create({
        message: 'Perfil añadido a guardados',
        duration: 1000,
        position: 'bottom',
        color: 'success',
        cssClass: 'like-toast'
      });
      await toast.present();

    } catch (error) {
      console.error('Error al dar like al perfil:', error);
      this.presentToast('Error al añadir perfil a guardados', 'danger');
    }
  }
}