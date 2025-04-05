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
import { IonAlert, IonAvatar, IonButton, IonCard, IonCardContent, IonContent, IonImg, IonRefresher, IonRefresherContent, IonSpinner, IonText } from '@ionic/angular/standalone';
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
    IonCard, IonCardContent, IonAvatar, IonImg, IonText, IonButton, IonAlert, IonSpinner, IonRefresher, IonRefresherContent, IonContent
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
      if (!this.formData || !this.userData) {
        console.error('Faltan datos del usuario o del formulario');
        return;
      }

      const allPotentialMatches: any[] = [];
      const currentUserId = this.auth.currentUser?.uid;

      // Solo proceder si tenemos el año lectivo del usuario actual
      if (!this.userData.anioLectivo) {
        console.error('Falta año lectivo del usuario actual');
        return;
      }

      const userAnioLectivo = this.userData.anioLectivo; // 'Segundo' o 'Tercero'
      console.log('Año lectivo del usuario actual:', userAnioLectivo);

      // Obtener carreras buscadas por el usuario
      const carrerasBuscadas = this.formData.carrera_buscada || [];
      console.log('Carreras buscadas:', carrerasBuscadas);

      // Si no hay carreras buscadas, no mostrar recomendaciones
      if (carrerasBuscadas.length === 0) {
        console.log('El usuario no ha seleccionado carreras para buscar');
        return;
      }

      // Convertir las carreras buscadas a sus nombres normalizados para la colección
      const collectionsToSearch = carrerasBuscadas.map(carrera => this.normalizeCarreraName(carrera));
      console.log('Colecciones a buscar:', collectionsToSearch);

      // Buscar en cada colección correspondiente a las carreras buscadas
      for (const collectionName of collectionsToSearch) {
        console.log(`Buscando en colección: ${collectionName}`);
        const carreraCollection = collection(this.firestore, collectionName);

        // Obtenemos todos los usuarios que no sean el usuario actual
        const q = query(carreraCollection, where('uid', '!=', currentUserId));
        const querySnapshot = await getDocs(q);

        console.log(`Encontrados ${querySnapshot.docs.length} documentos en ${collectionName}`);

        // Para cada usuario en la colección
        for (const docSnap of querySnapshot.docs) {
          // Obtener la información general del usuario
          const userGeneralDoc = await getDoc(doc(this.firestore, 'usuarios', docSnap.id));
          const userData = userGeneralDoc.data();

          if (!userData) {
            console.log(`Sin datos para usuario ${docSnap.id}`);
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

            console.log(`Usuario ${userFormData['nombreUsuario'] || 'sin nombre'}, Año: ${otherUserYear}, Carrera: ${userCarrera}`);

            // FILTRO CRÍTICO: Verificar que sean del mismo año lectivo
            if (otherUserYear !== userAnioLectivo) {
              console.log(`Descartando - Año diferente: ${otherUserYear} vs ${userAnioLectivo}`);
              continue; // Si no son del mismo año, saltar este usuario
            }

            // Calcular puntuación de compatibilidad con énfasis en habilidades
            const matchDetails = this.calculateDetailedMatchScore(userFormData, userCarrera);
            console.log(`Match score para ${userFormData['nombreUsuario'] || 'sin nombre'}: 
              Total: ${matchDetails.totalScore}, 
              Habilidades: ${matchDetails.skillScore}, 
              Otros: ${matchDetails.otherScore}`);

            allPotentialMatches.push({
              uid: docSnap.id,
              nombreUsuario: userFormData['nombreUsuario'] || 'Usuario',
              nombre: userFormData['nombre'] || '',
              apellido: userFormData['apellido'] || '',
              carrera: userCarrera || '',
              anioLectivo: otherUserYear || '',
              mencion: userFormData['mencion'] || '',
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

      console.log(`Total de matches potenciales: ${allPotentialMatches.length}`);

      console.log("Matches potenciales (sin filtrar):", allPotentialMatches.map(u => ({
        nombre: u.nombreUsuario,
        anio: u.anioLectivo,
        carrera: u.carrera,
        totalScore: u.matchScore,
        skillScore: u.skillScore
      })));

      // Ordenar primero por puntuación de habilidades (mayor a menor) y luego por puntuación total
      this.recommendedUsers = allPotentialMatches
        .sort((a, b) => {
          // Primero ordenar por coincidencia de habilidades
          if (b.skillScore !== a.skillScore) {
            return b.skillScore - a.skillScore;
          }
          // En caso de empate, usar la puntuación total
          return b.matchScore - a.matchScore;
        })
        .slice(0, 20); // Aumentar a 20 para tener más variedad de recomendaciones

      console.log(`Recomendaciones finales: ${this.recommendedUsers.length}`);

    } catch (error) {
      console.error('Error al cargar recomendaciones:', error);
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

  async handleRefresh(event: any) {
    console.log('Comenzando operación de actualización');
    
    try {
      // Reiniciar estados
      this.loading = true;
      this.recommendedUsers = [];
      
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
        }
      }
    } catch (error) {
      console.error('Error al actualizar datos:', error);
    } finally {
      // Completar el evento de actualización para ocultar el spinner
      event.target.complete();
      this.loading = false;
    }
  }
}