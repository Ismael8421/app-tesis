import { NgIf, NgFor, CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, Component, ElementRef, inject } from '@angular/core';
import { Auth, User } from '@angular/fire/auth';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { register } from 'swiper/element/bundle';
import { ChatService } from '../chats/data-access/chat.service';
import { Observable } from 'rxjs';
import { AlertController, IonAlert, IonAvatar, IonButton, IonCard, IonCardContent, IonContent, IonIcon, IonImg, IonRefresher, IonRefresherContent, IonSpinner, IonText, ToastController } from '@ionic/angular/standalone';
import { FormStateService } from '../../form/data-access/form-state.service';
import { CheckIconComponent } from '../../UI/check-icon/check-icon.component';
import { MessagesIconComponent } from '../../UI/messages-icon/messages-icon.component';
import { HeartIconComponent } from '../../UI/heart-icon/heart-icon.component';
import { RegisterService, userCreate } from '../../register/data-access/register.service';
import { FormService, formCreate } from '../../form/data-access/form.service';
import { Firestore, collection, doc, getDoc, getDocs, query, where } from '@angular/fire/firestore';
import { RejectedProfilesService } from './data-access/rejected-profiles.service';
import { LikedProfilesService } from './data-access/iked-profiles.service';
import { ProfileVisibilityService, VisibilityType } from './data-access/profile-visibility.service';
import { UserActivityService } from '../shared/data-access/user-activity.service';
import { RecommendationCacheService } from './data-access/recommendation-cache.service';

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
  private recommendationCacheService = inject(RecommendationCacheService);
  private cachedLoaded = false;

  recommendedUsers: any[] = [];
  loading = true;
  loadingMore = false; // Track loading of additional batches

  userData: userCreate | null = null;
  formData: formCreate | null = null;
  isFormComplete: boolean = true;
  showAlert: boolean = false;

  rejectedProfiles: string[] = [];
  likedProfiles: string[] = [];

  userVisibility: VisibilityType = 'visible';

  private carreraCollections = [
    'Informatica',
    'IEME',
    'MCM',
    'EMA',
    'Mecatronica',
    'Ciencias'
  ];

  private batchSize = 5; // Number of profiles to load per batch
  allPotentialMatches: any[] = []; // Store all potential matches
  currentBatchIndex = 0; // Track the current batch index

  alertButtons = [{
    text: 'Ir',
    handler: () => {
      this.navegateToForm();
    }
  }];

  constructor(
    private profileVisibilityService: ProfileVisibilityService,
    private elementRef: ElementRef
  ) {
    this.profileVisibilityService.getProfileStatus()
      .subscribe((status: { visibility: VisibilityType }) => {
        this.userVisibility = status.visibility;
      });
  }

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
          const [registerData, formData, formCompleted] = await Promise.all([
            this.registerService.getUserData(user.uid),
            this.formService.getFormData(user.uid),
            this.formStateService.checkFormCompletion(user.uid)
          ]);

          this.userData = registerData;
          this.formData = formData;
          this.isFormComplete = formCompleted;
          this.showAlert = !formCompleted;

          this.rejectedProfilesService.getRejectedProfiles().subscribe(
            profiles => {
              this.rejectedProfiles = profiles;
              console.log('Perfiles rechazados cargados:', this.rejectedProfiles.length);
            }
          );

          this.likedProfilesService.getLikedProfiles().subscribe(
            profiles => {
              this.likedProfiles = profiles;
              console.log('Perfiles con like cargados:', this.likedProfiles.length);
            }
          );

          if (formCompleted && this.userData && this.formData) {
            await this.loadRecommendationsWithCache();
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
      this.userActivityService.registerActivity('start_chat');
      if (chatId) {
        this.router.navigate(['/menu/mensajes', chatId]);
      }
    } catch (error) {
      console.error('Error starting chat:', error);
    }
  }

  async loadRecommendationsWithCache() {
    if (!this.userData || !this.formData) {
      console.error('Faltan datos del usuario o del formulario');
      this.loading = false;
      return;
    }

    console.log('🔍 Iniciando loadRecommendationsWithCache...');

    const queryParams = {
      carrerasBuscadas: this.formData.carrera_buscada || [],
      anioLectivo: this.userData.anioLectivo || ''
    };

    console.log('🔍 Parámetros de búsqueda:', JSON.stringify(queryParams));

    console.log('🔍 Intentando cargar desde caché...');
    const cachedLoaded = await this.recommendationCacheService.loadFromCache(queryParams);

    if (cachedLoaded) {
      console.log('✅ Recomendaciones cargadas desde caché con éxito');
      this.cachedLoaded = true;
      this.loading = false;

      this.recommendationCacheService.getCachedRecommendations().subscribe(
        recommendations => {
          console.log(`🔍 Recibidas ${recommendations.length} recomendaciones del caché`);
          if (recommendations && recommendations.length > 0) {
            this.allPotentialMatches = recommendations.filter(
              match => !this.rejectedProfiles.includes(match.uid) &&
                !this.likedProfiles.includes(match.uid)
            );
            console.log(`🔍 Filtrado: ${recommendations.length} → ${this.allPotentialMatches.length} después de eliminar rechazados/likes`);

            this.loadNextBatch();

            if (this.allPotentialMatches.length < this.batchSize) {
              console.log('ℹ️ Pocas recomendaciones en caché, cargando más en segundo plano...');
              setTimeout(() => {
                this.loadRecommendations();
              }, 1000);
            }
          } else {
            console.log('⚠️ Cache vacío, cargando recomendaciones normalmente');
            this.loading = true;
            this.loadRecommendations();
          }
        }
      );
    } else {
      console.log('⚠️ No hay caché válido, cargando recomendaciones desde cero...');
      this.loading = true;
      await this.loadRecommendations();
    }
  }

  async loadRecommendations() {
    console.log("Comenzando búsqueda de recomendaciones para usuario:", this.userData);

    try {
      if (!this.formData || !this.userData) {
        console.error('Faltan datos del usuario o del formulario');
        return;
      }

      this.allPotentialMatches = [];
      const currentUserId = this.auth.currentUser?.uid;

      if (!this.userData.anioLectivo) {
        console.error('Falta año lectivo del usuario actual');
        return;
      }

      const userAnioLectivo = this.userData.anioLectivo;
      console.log('Año lectivo del usuario actual:', userAnioLectivo);

      const carrerasBuscadas = this.formData.carrera_buscada || [];
      console.log('Carreras buscadas:', carrerasBuscadas);

      if (carrerasBuscadas.length === 0) {
        console.log('El usuario no ha seleccionado carreras para buscar');
        return;
      }

      const collectionsToSearch = carrerasBuscadas.map(carrera => this.normalizeCarreraName(carrera));
      console.log('Colecciones a buscar:', collectionsToSearch);

      for (const collectionName of collectionsToSearch) {
        console.log(`Buscando en colección: ${collectionName}`);
        const carreraCollection = collection(this.firestore, collectionName);
        const q = query(carreraCollection, where('uid', '!=', currentUserId));
        const querySnapshot = await getDocs(q);

        console.log(`Encontrados ${querySnapshot.docs.length} documentos en ${collectionName}`);

        for (const docSnap of querySnapshot.docs) {
          const userGeneralDoc = await getDoc(doc(this.firestore, 'usuarios', docSnap.id));
          const userData = userGeneralDoc.data();

          if (!userData) {
            console.log(`Sin datos para usuario ${docSnap.id}`);
            continue;
          }

          const formCompleted = userData['formCompleted'] ?? false;

          if (formCompleted) {
            const userFormData = docSnap.data();
            const otherUserData = await this.registerService.getUserData(docSnap.id);
            const otherUserYear = otherUserData?.anioLectivo;
            const userCarrera = userData['carrera'];
            const profileImageUrl = userData['profileImageUrl'] || 'icons/logo_tesis.png';

            console.log(`Usuario ${userFormData['nombreUsuario'] || 'sin nombre'}, Año: ${otherUserYear}, Carrera: ${userCarrera}`);

            if (otherUserYear !== userAnioLectivo) {
              console.log(`Descartando - Año diferente: ${otherUserYear} vs ${userAnioLectivo}`);
              continue;
            }

            const visibilityRef = doc(this.firestore, 'profileVisibility', docSnap.id);
            const visibilitySnap = await getDoc(visibilityRef);

            if (visibilitySnap.exists() && visibilitySnap.data()?.['visibility'] === 'invisible') {
              console.log(`Descartando - Perfil invisible: ${docSnap.id}`);
              continue;
            }

            if (this.rejectedProfiles.includes(docSnap.id) || this.likedProfiles.includes(docSnap.id)) {
              console.log(`Descartando - Perfil rechazado o con like: ${docSnap.id}`);
              continue;
            }

            const matchDetails = this.calculateDetailedMatchScore(userFormData, userCarrera);
            console.log(`Match score para ${userFormData['nombreUsuario'] || 'sin nombre'}: 
              Total: ${matchDetails.totalScore}, 
              Habilidades: ${matchDetails.skillScore}, 
              Otros: ${matchDetails.otherScore}`);

            this.allPotentialMatches.push({
              uid: docSnap.id,
              nombreUsuario: userFormData['nombreUsuario'] || 'Usuario',
              nombre: userFormData['nombre'] || '',
              apellido: userFormData['apellido'] || '',
              carrera: userCarrera || '',
              anioLectivo: otherUserYear || '',
              mencion: userFormData['mencion'] || '',
              paralelo: userFormData['paralelo'] || '',
              profileImageUrl: profileImageUrl,
              ...userFormData,
              matchScore: matchDetails.totalScore,
              skillScore: matchDetails.skillScore,
              otherScore: matchDetails.otherScore
            });
          } else {
            console.log(`Descartando - Formulario no completado`);
          }
        }
      }

      console.log(`Total de matches potenciales: ${this.allPotentialMatches.length}`);

      this.allPotentialMatches.sort((a, b) => {
        if (b.skillScore !== a.skillScore) {
          return b.skillScore - a.skillScore;
        }
        return b.matchScore - a.matchScore;
      });

      if (this.allPotentialMatches.length > 0) {
        const queryParams = {
          carrerasBuscadas: this.formData.carrera_buscada || [],
          anioLectivo: this.userData.anioLectivo || ''
        };
        await this.recommendationCacheService.cacheRecommendations(this.allPotentialMatches, queryParams);
      }

      this.currentBatchIndex = 0;
      this.loadNextBatch();

    } catch (error) {
      console.error('Error al cargar recomendaciones:', error);
    } finally {
      this.loading = false;
    }
  }

  private loadNextBatch() {
    if (this.currentBatchIndex >= this.allPotentialMatches.length) {
      console.log('No hay más perfiles para cargar');
      this.loadingMore = false;
      return;
    }

    this.loadingMore = true;
    const startIndex = this.currentBatchIndex;
    const endIndex = Math.min(startIndex + this.batchSize, this.allPotentialMatches.length);
    const newBatch = this.allPotentialMatches.slice(startIndex, endIndex);

    this.recommendedUsers = [...this.recommendedUsers, ...newBatch];
    this.currentBatchIndex = endIndex;

    console.log(`Cargado lote de ${newBatch.length} perfiles, total cargados: ${this.recommendedUsers.length}`);

    setTimeout(() => {
      const swiperEl = document.querySelector('swiper-container');
      if (swiperEl && swiperEl.swiper) {
        swiperEl.swiper.update();
      }
      this.loadingMore = false;
    }, 100);
  }

  private calculateMatchScore(otherUserData: any, otherUserCarrera: string): number {
    if (!this.formData || !otherUserData) return 0;

    let matchScore = 0;
    console.log(`Calculando puntuación para usuario con carrera: ${otherUserCarrera}`);

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
      matchScore += 30;
      console.log(`+30 puntos por carrera buscada: ${normalizedCarrera}`);
    } else {
      console.log(`Carrera no está entre las buscadas: ${normalizedCarrera}`);
    }

    if (this.formData.horario && otherUserData.horario) {
      const commonSchedules = this.formData.horario.filter(
        horario => otherUserData.horario?.includes(horario)
      );
      matchScore += commonSchedules.length * 5;
      console.log(`+${commonSchedules.length * 5} puntos por ${commonSchedules.length} horarios compatibles`);
    } else {
      console.log('No se pudo evaluar compatibilidad de horarios');
    }

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

    const skillScore = this.evaluateSkillsMatch(otherUserData, otherUserCarrera);
    matchScore += skillScore;

    console.log(`Puntuación final de compatibilidad: ${matchScore}`);
    return matchScore;
  }

  private evaluateSkillsMatch(otherUserData: any, otherUserCarrera: string): number {
    if (!this.formData || !this.userData) return 0;

    if (!this.userData.anioLectivo) {
      console.log('No se puede evaluar skills sin año lectivo definido');
      return 0;
    }

    let skillMatchScore = 0;
    const valorHabilidad = { 'Alto': 3, 'Medio': 2, 'Bajo': 1 };

    const carreraAlias = {
      'Informatica': 'informatica',
      'IEME': 'ieme',
      'MCM': 'mcm',
      'EMA': 'ema',
      'Mecatronica': 'mecatronica',
      'Ciencias': 'ciencias'
    };

    const otherUserCarreraAlias = carreraAlias[otherUserCarrera as keyof typeof carreraAlias] || '';

    if (this.formData.carrera_buscada.includes(otherUserCarreraAlias)) {
      console.log(`Evaluando habilidades para carrera: ${otherUserCarrera}`);

      const userAnioLectivo = this.userData.anioLectivo;

      if (userAnioLectivo === 'Tercero') {
        console.log('Evaluando habilidades para Tercero');
        return this.evaluateTerceroSkills(otherUserData, otherUserCarrera);
      } else if (userAnioLectivo === 'Segundo') {
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

  private evaluateTerceroSkills(otherUserData: any, otherUserCarrera: string): number {
    if (!this.formData) return 0;

    let skillMatchScore = 0;
    const valorHabilidad = { 'Alto': 3, 'Medio': 2, 'Bajo': 1 };

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

  private evaluateSegundoSkills(otherUserData: any, otherUserCarrera: string): number {
    if (!this.formData) return 0;

    let skillMatchScore = 0;
    const valorHabilidad = { 'Alto': 3, 'Medio': 2, 'Bajo': 1 };

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
      otherScore += 30;
      console.log(`+30 puntos por carrera buscada: ${normalizedCarrera}`);
    } else {
      console.log(`Carrera no está entre las buscadas: ${normalizedCarrera}`);
    }

    if (this.formData.horario && otherUserData.horario) {
      const commonSchedules = this.formData.horario.filter(
        horario => otherUserData.horario?.includes(horario)
      );
      otherScore += commonSchedules.length * 5;
      console.log(`+${commonSchedules.length * 5} puntos por ${commonSchedules.length} horarios compatibles`);
    } else {
      console.log('No se pudo evaluar compatibilidad de horarios');
    }

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

    const skillScore = this.evaluateSkillsMatch(otherUserData, otherUserCarrera);

    const totalScore = otherScore + skillScore;

    console.log(`Puntuación detallada: Total=${totalScore}, Habilidades=${skillScore}, Otros=${otherScore}`);
    return { totalScore, skillScore, otherScore };
  }

  async handleRefresh(event?: any) {
    console.log('Comenzando operación de actualización');

    try {
      this.loading = true;
      this.recommendedUsers = [];
      this.allPotentialMatches = [];
      this.currentBatchIndex = 0;

      const user = this.auth.currentUser;
      if (user) {
        const [registerData, formData, formCompleted] = await Promise.all([
          this.registerService.getUserData(user.uid),
          this.formService.getFormData(user.uid),
          this.formStateService.checkFormCompletion(user.uid)
        ]);

        this.userData = registerData;
        this.formData = formData;
        this.isFormComplete = formCompleted;

        if (formCompleted && this.userData && this.formData) {
          await this.loadRecommendations();

          setTimeout(() => {
            const swiperEl = document.querySelector('swiper-container');
            if (swiperEl && swiperEl.swiper) {
              swiperEl.swiper.slideTo(0, 0);
            }
          }, 100);
        }
      }
    } catch (error) {
      console.error('Error al actualizar datos:', error);
    } finally {
      if (event && event.target && event.target.complete) {
        event.target.complete();
      }
      this.loading = false;
    }
  }

  onSlideChange(event: any) {
    const swiperEl = event.target;
    const currentIndex = swiperEl.swiper.realIndex;

    if (currentIndex >= this.recommendedUsers.length - 2 && !this.loadingMore) {
      console.log('Usuario cerca del final, cargando más perfiles...');
      this.loadNextBatch();
    }

    if (currentIndex === this.recommendedUsers.length) {
      console.log('Usuario ha llegado al final de las recomendaciones');
    }
  }

  async rejectProfile(user: any) {
    if (!user || !user.uid) {
      console.error('ID de usuario no válido para rechazar');
      return;
    }

    try {
      const swiperEl = document.querySelector('swiper-container');
      if (!swiperEl || !swiperEl.swiper) return;

      const activeIndex = swiperEl.swiper.activeIndex;
      const activeSlide = swiperEl.querySelectorAll('swiper-slide')[activeIndex];
      if (!activeSlide) return;

      const card = activeSlide.querySelector('ion-card');
      if (!card) return;

      activeSlide.classList.add('animating');
      card.classList.add('profile-rejected');

      this.rejectedProfilesService.rejectProfile(user.uid);
      this.userActivityService.registerActivity('profile_reject');

      await new Promise(resolve => setTimeout(resolve, 500));

      this.recommendedUsers = this.recommendedUsers.filter(u => u.uid !== user.uid);
      this.allPotentialMatches = this.allPotentialMatches.filter(u => u.uid !== user.uid);

      if (this.cachedLoaded && this.recommendedUsers.length > 0) {
        const queryParams = {
          carrerasBuscadas: this.formData?.carrera_buscada || [],
          anioLectivo: this.userData?.anioLectivo || ''
        };
        await this.recommendationCacheService.cacheRecommendations(this.allPotentialMatches, queryParams);
      }

      if (this.recommendedUsers.length === 0) {
        this.loading = false;
      } else if (swiperEl.swiper.activeIndex >= this.recommendedUsers.length) {
        swiperEl.swiper.slideTo(this.recommendedUsers.length - 1);
      } else {
        swiperEl.swiper.update();
      }

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
      const swiperEl = document.querySelector('swiper-container');
      if (!swiperEl || !swiperEl.swiper) return;

      const activeIndex = swiperEl.swiper.activeIndex;
      const activeSlide = swiperEl.querySelectorAll('swiper-slide')[activeIndex];
      if (!activeSlide) return;

      const card = activeSlide.querySelector('ion-card');
      if (!card) return;

      activeSlide.classList.add('animating');
      card.classList.add('profile-liked');

      this.likedProfilesService.likeProfile(user.uid);
      this.userActivityService.registerActivity('profile_like');

      await new Promise(resolve => setTimeout(resolve, 500));

      this.recommendedUsers = this.recommendedUsers.filter(u => u.uid !== user.uid);
      this.allPotentialMatches = this.allPotentialMatches.filter(u => u.uid !== user.uid);

      if (this.cachedLoaded && this.recommendedUsers.length > 0) {
        const queryParams = {
          carrerasBuscadas: this.formData?.carrera_buscada || [],
          anioLectivo: this.userData?.anioLectivo || ''
        };
        await this.recommendationCacheService.cacheRecommendations(this.allPotentialMatches, queryParams);
      }

      if (this.recommendedUsers.length === 0) {
        this.loading = false;
      } else if (swiperEl.swiper.activeIndex >= this.recommendedUsers.length) {
        swiperEl.swiper.slideTo(this.recommendedUsers.length - 1);
      } else {
        swiperEl.swiper.update();
      }

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

  ngAfterViewInit() {
    // Espera un momento para asegurarte de que el DOM está listo
    setTimeout(() => {
      // Selecciona solo la primera tarjeta y añade la clase
      const firstSlide = this.elementRef.nativeElement.querySelector('swiper-slide');
      if (firstSlide) {
        firstSlide.classList.add('initial-card');
      }
    }, 100);
  }
}