import { Component, EventEmitter, NgModule, Output, inject, signal } from '@angular/core';
import { PreferencesComponent } from '../form-questions/preferences/preferences.component';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { WantedProfessionComponent } from '../form-questions/wanted-profession/wanted-profession.component';
import { ComputingComponent } from '../form-questions/wanted-skills/computing/computing.component';
import { PersComputingComponent } from '../form-questions/offer-skills/pers-computing/pers-computing.component';
import { RegisterService, userCreate } from '../../register/data-access/register.service';
import { Router } from '@angular/router';
import { AuthService } from '../../account/auth/data-access/auth.service';
import { FormService, formCreate } from '../data-access/form.service';
import { EMAComponent } from '../form-questions/wanted-skills/ema/ema.component';
import { IEMEComponent } from '../form-questions/wanted-skills/ieme/ieme.component';
import { MCMComponent } from '../form-questions/wanted-skills/mcm/mcm.component';
import { MechatronicsComponent } from '../form-questions/wanted-skills/mechatronics/mechatronics.component';
import { FormStateService } from '../data-access/form-state.service';
import { Firestore, doc, getDoc, setDoc, updateDoc } from '@angular/fire/firestore';
import { IonButton, IonList, IonText } from '@ionic/angular/standalone';
import { ScienceComponent } from '../form-questions/wanted-skills/science/science.component';
import { PersIEMEComponent } from '../form-questions/offer-skills/pers-ieme/pers-ieme.component';
import { PersMCMComponent } from '../form-questions/offer-skills/pers-mcm/pers-mcm.component';
import { PersEMAComponent } from '../form-questions/offer-skills/pers-ema/pers-ema.component';
import { PersMechatronicsComponent } from '../form-questions/offer-skills/pers-mechatronics/pers-mechatronics.component';
import { SciencesComponent } from '../form-questions/offer-skills/sciences/sciences.component';

@Component({
  selector: 'app-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    PreferencesComponent,
    WantedProfessionComponent,
    IEMEComponent,
    MCMComponent,
    EMAComponent,
    MechatronicsComponent,
    ComputingComponent,
    ScienceComponent,
    PersIEMEComponent,
    PersMCMComponent,
    PersEMAComponent,
    PersMechatronicsComponent,
    SciencesComponent,
    PersComputingComponent,
    IonText,
    IonList,
    IonButton
  ],
  templateUrl: './form.component.html',
  styleUrl: './form.component.scss',
})
export class FormComponent {
  private _registerService = inject(RegisterService);
  private _formService = inject(FormService);
  private _auth = inject(AuthService);
  private _router = inject(Router);
  private _firestore = inject(Firestore);

  userData: userCreate | null = null;
  loading = signal(false);

  form: FormGroup;
  page: number = 1;

  showErrors = false;

  @Output() showFormErrors = new EventEmitter<boolean>();
  

  nextPage() {
    if (this.isPageComplete(this.page)) {
      // Si la página está completa, avanzar
      if (this.page < 7) {
        this.page++;
      }
      // Reset showErrors cuando avanzamos
      this.showErrors = false;
    } else {
      // Si la página no está completa, mostrar errores
      this.showErrors = true;
      this.showFormErrors.emit(true);
    }
  }

  prevPage() {
    if (this.page > 1) {
      this.page--;
    }
  }

  constructor(private formStateService: FormStateService) {
    this.form = new FormGroup({
      schedule: new FormGroup({
        Q1O1: new FormControl(false),
        Q1O2: new FormControl(false),
        Q1O3: new FormControl(false),
        Q1O4: new FormControl(false)
      }, this.atLeastOneCheckedValidator()),
      method: new FormControl(''),
      hours: new FormControl(''),
      wanted_profession: new FormGroup({
        O1: new FormControl(false),
        O2: new FormControl(false),
        O3: new FormControl(false),
        O4: new FormControl(false),
        O5: new FormControl(false),
        O6: new FormControl(false)
      }, this.atLeastOneCheckedValidator()),

      //busca segundos
      wanted_skills_sec_ieme: new FormGroup({
        installationsSec: new FormControl(''),
        electricalEngSec: new FormControl(''),
        electronicsSec: new FormControl(''),
        automationElecSec: new FormControl('')
      }),
      wanted_skills_sec_mcm: new FormGroup({
        weldingMcmSec: new FormControl(''),
        millingSec: new FormControl(''),
        latheSec: new FormControl(''),
        drawingMcmSec: new FormControl('')
      }),
      wanted_skills_sec_ema: new FormGroup({
        systemSec: new FormControl(''),
        electronicSec: new FormControl(''),
        maintenanceSec: new FormControl('')
      }),
      wanted_skills_sec_mec: new FormGroup({
        digitalElectronics: new FormControl(''),
        cncSec: new FormControl(''),
        manufactureSec: new FormControl(''),
        automationSystems: new FormControl('')
      }),
      wanted_skills_sec_inf: new FormGroup({
        programing: new FormControl(''),
        support: new FormControl(''),
        web: new FormControl(''),
        networks: new FormControl('')
      }),
      wanted_skills_sec_science: new FormGroup({
        lab: new FormControl(''),
        psychology: new FormControl(''),
        creativeWritingSec: new FormControl('')
      }),

      //busca terceros
      wanted_skills_third_ieme: new FormGroup({
        electricalEng: new FormControl(''),
        installations: new FormControl(''),
        automationElec: new FormControl(''),
        electronics: new FormControl(''),
        power: new FormControl(''),
        machines: new FormControl(''),
        industrial: new FormControl(''),
        microcontrollersIeme: new FormControl(''),
        appliedElectronics: new FormControl(''),
        communications: new FormControl(''),
        computersNetworks: new FormControl('')
      }),
      wanted_skills_third_mcm: new FormGroup({
        metrology: new FormControl(''),
        metallurgy: new FormControl(''),
        weldingMcm: new FormControl(''),
        milling: new FormControl(''),
        lathe: new FormControl(''),
        pneumatics: new FormControl(''),
        manufacturingMcm: new FormControl(''),
        drawingMcm: new FormControl(''),
        automationMcm: new FormControl(''),
        machinesMcm: new FormControl(''),
        molds: new FormControl('')
      }),
      wanted_skills_third_ema: new FormGroup({
        engines: new FormControl(''),
        safety: new FormControl(''),
        electronicSystems: new FormControl(''),
        electricalSystems: new FormControl(''),
        drawingEma: new FormControl(''),
        maintenance: new FormControl(''),
        automotive: new FormControl('')
      }),
      wanted_skills_third_science: new FormGroup({
        creativeWriting: new FormControl(''),
        drawingScience: new FormControl(''),
        research: new FormControl(''),
        biology: new FormControl(''),
        morphology: new FormControl(''),
        sociology: new FormControl(''),
        politics: new FormControl(''),
        mathematics: new FormControl(''),
        physics: new FormControl('')
      }),
      wanted_skills_third_mec: new FormGroup({
        microcontrollers: new FormControl(''),
        servomechanisms: new FormControl(''),
        automation: new FormControl(''),
        drawingMec: new FormControl(''),
        simulation: new FormControl(''),
        programmingMec: new FormControl(''),
        weldingMec: new FormControl(''),
        manufacture: new FormControl(''),
        cnc: new FormControl('')
      }),
      wanted_skills_third_inf: new FormGroup({
        programming1: new FormControl(''),
        desing: new FormControl(''),
        cad: new FormControl(''),
        support1: new FormControl(''),
        mobile: new FormControl(''),
        web1: new FormControl(''),
        networks1: new FormControl('')
      }),

      //ofrecido segundos
      offer_skills_sec_ieme: new FormGroup({
        installationsSec: new FormControl(''),
        electricalEngSec: new FormControl(''),
        electronicsSec: new FormControl(''),
        automationElecSec: new FormControl('')
      }),
      offer_skills_sec_mcm: new FormGroup({
        weldingMcmSec: new FormControl(''),
        millingSec: new FormControl(''),
        latheSec: new FormControl(''),
        drawingMcmSec: new FormControl('')
      }),
      offer_skills_sec_ema: new FormGroup({
        systemSec: new FormControl(''),
        electronicSec: new FormControl(''),
        maintenanceSec: new FormControl('')
      }),
      offer_skills_sec_mec: new FormGroup({
        digitalElectronics: new FormControl(''),
        cncSec: new FormControl(''),
        manufactureSec: new FormControl(''),
        automationSystems: new FormControl('')
      }),
      offer_skills_sec_inf: new FormGroup({
        programing: new FormControl(''),
        support: new FormControl(''),
        web: new FormControl(''),
        networks: new FormControl('')
      }),
      offer_skills_sec_sciences: new FormGroup({
        lab: new FormControl(''),
        psychology: new FormControl(''),
        creativeWritingSec: new FormControl(''),
      }),


      //ofrecido terceros
      offer_skills_third_ieme: new FormGroup({
        electricalEng: new FormControl(''),
        installations: new FormControl(''),
        automationElec: new FormControl(''),
        electronics: new FormControl(''),
        power: new FormControl(''),
        machines: new FormControl(''),
        industrial: new FormControl(''),
        microcontrollersIeme: new FormControl(''),
        appliedElectronics: new FormControl(''),
        communications: new FormControl(''),
        computersNetworks: new FormControl(''),
      }),
      offer_skills_third_mcm: new FormGroup({
        metrology: new FormControl(''),
        metallurgy: new FormControl(''),
        weldingMcm: new FormControl(''),
        milling: new FormControl(''),
        lathe: new FormControl(''),
        pneumatics: new FormControl(''),
        manufacturingMcm: new FormControl(''),
        drawingMcm: new FormControl(''),
        automationMcm: new FormControl(''),
        machinesMcm: new FormControl(''),
        molds: new FormControl('')
      }),
      offer_skills_third_ema: new FormGroup({
        engines: new FormControl(''),
        safety: new FormControl(''),
        electronicSystems: new FormControl(''),
        electricalSystems: new FormControl(''),
        drawingEma: new FormControl(''),
        maintenance: new FormControl(''),
        automotive: new FormControl('')
      }),
      offer_skills_third_mec: new FormGroup({
        microcontrollers: new FormControl(''),
        servomechanisms: new FormControl(''),
        automation: new FormControl(''),
        drawingMec: new FormControl(''),
        simulation: new FormControl(''),
        programmingMec: new FormControl(''),
        weldingMec: new FormControl(''),
        manufacture: new FormControl(''),
        cnc: new FormControl(''),
      }),
      offer_skills_third_inf: new FormGroup({
        programming1: new FormControl(''),
        desing: new FormControl(''),
        cad: new FormControl(''),
        support1: new FormControl(''),
        mobile: new FormControl(''),
        web1: new FormControl(''),
        networks1: new FormControl('')
      }),
      offer_skills_third_sciences: new FormGroup({
        creativeWriting: new FormControl(''),
        drawingScience: new FormControl(''),
        research: new FormControl(''),
        biology: new FormControl(''),
        morphology: new FormControl(''),
        sociology: new FormControl(''),
        politics: new FormControl(''),
        mathematics: new FormControl(''),
        physics: new FormControl('')
      }),
    });
  }

  shouldShowComponent(componentName: string): boolean {
    const professionValues = this.form.get('wanted_profession')?.value;

    switch (componentName) {
      case 'ieme':
        return professionValues?.O1 === true; // Circuitos eléctricos
      case 'mcm':
        return professionValues?.O2 === true; // Construcción metálica
      case 'ema':
        return professionValues?.O3 === true; // Mantenimiento automotriz
      case 'mechatronics':
        return professionValues?.O4 === true; // Mecánica y automatización
      case 'computing':
        return professionValues?.O5 === true; // Desarrollo software
      case 'sciences':
        return professionValues?.O6 === true; // Biología y química
      default:
        return false;
    }
  }

  private atLeastOneCheckedValidator(): ValidatorFn {
    return (formGroup: AbstractControl): ValidationErrors | null => {
      if (!formGroup || !(formGroup instanceof FormGroup)) {
        return null;
      }

      const selections = Object.values(formGroup.value);
      const hasSelection = selections.some(value => value === true);

      return hasSelection ? null : { requireCheckbox: true };
    };
  }

  async submit() {
    if (this.form.invalid) {
      console.log('Formulario inválido, pero continuaremos para debug');
    }

    this.loading.set(true);

    try {
      const currentUser = this._auth.currentUser;
      if (!currentUser || !currentUser.uid) {
        console.error('No se encontró un usuario autenticado.');
        return;
      }

      const formData: formCreate = {
        horario: this.getSelectedHorario(),
        metodo: this.form.get('method')?.value || '',
        horas: this.form.get('hours')?.value || '',
        carrera_buscada: this.getSelectedCarreras(),
        habilidad_buscada_seg: {
          ieme_seg: {
            instalacionesSeg: this.form.get('wanted_skills_sec_ieme')?.get('installationsSec')?.value || '',
            electricidadSeg: this.form.get('wanted_skills_sec_ieme')?.get('electricalEngSec')?.value || '',
            electronicaSeg: this.form.get('wanted_skills_sec_ieme')?.get('electronicsSec')?.value || '',
            automatizacionSeg: this.form.get('wanted_skills_sec_ieme')?.get('automationElecSec')?.value || ''
          },
          mcm_seg: {
            soldaduraMcmSeg: this.form.get('wanted_skills_sec_mcm')?.get('weldingMcmSec')?.value || '',
            fresadoraSeg: this.form.get('wanted_skills_sec_mcm')?.get('millingSec')?.value || '',
            tornoSeg: this.form.get('wanted_skills_sec_mcm')?.get('latheSec')?.value || '',
            dibujoMcmSeg: this.form.get('wanted_skills_sec_mcm')?.get('drawingMcmSec')?.value || '',
          },
          ema_seg: {
            sistemasSeg: this.form.get('wanted_skills_sec_ema')?.get('systemSec')?.value || '',
            electronicaSeg: this.form.get('wanted_skills_sec_ema')?.get('electronicSec')?.value || '',
            mantenimientoSeg: this.form.get('wanted_skills_sec_ema')?.get('maintenanceSec')?.value || '',
          },
          mec_seg: {
            electronicaDigital: this.form.get('wanted_skills_sec_mec')?.get('digitalElectronics')?.value || '',
            cncMecSeg: this.form.get('wanted_skills_sec_mec')?.get('cncSec')?.value || '',
            manufacturaMecSeg: this.form.get('wanted_skills_sec_mec')?.get('manufactureSec')?.value || '',
            automatizacionMecSeg: this.form.get('wanted_skills_sec_mec')?.get('automationSystems')?.value || ''
          },
          informatica_seg: {
            programacion: this.form.get('wanted_skills_sec_inf')?.get('programing')?.value || '',
            soporte: this.form.get('wanted_skills_sec_inf')?.get('support')?.value || '',
            web: this.form.get('wanted_skills_sec_inf')?.get('web')?.value || '',
            redes: this.form.get('wanted_skills_sec_inf')?.get('networks')?.value || ''
          },
          ciencias_seg: {
            laboratorio: this.form.get('wanted_skills_sec_science')?.get('lab')?.value || '',
            psicologia: this.form.get('wanted_skills_sec_science')?.get('psychology')?.value || '',
            redaccionCreativaSeg: this.form.get('wanted_skills_sec_science')?.get('creativeWritingSec')?.value || ''
          }
        },
        habilidad_buscada_ter: {
          ieme_ter: {
            electrotecnia: this.form.get('wanted_skills_third_ieme')?.get('electricalEng')?.value || '',
            instalaciones: this.form.get('wanted_skills_third_ieme')?.get('installations')?.value || '',
            automatismosEle: this.form.get('wanted_skills_third_ieme')?.get('automationElec')?.value || '',
            electronica: this.form.get('wanted_skills_third_ieme')?.get('electronics')?.value || '',
            potencia: this.form.get('wanted_skills_third_ieme')?.get('power')?.value || '',
            maquinas: this.form.get('wanted_skills_third_ieme')?.get('machines')?.value || '',
            industrial: this.form.get('wanted_skills_third_ieme')?.get('industrial')?.value || '',
            microcontroladores: this.form.get('wanted_skills_third_ieme')?.get('microcontrollersIeme')?.value || '',
            electronicaAplicada: this.form.get('wanted_skills_third_ieme')?.get('appliedElectronics')?.value || '',
            comunicaciones: this.form.get('wanted_skills_third_ieme')?.get('communications')?.value || '',
            redesComputadoras: this.form.get('wanted_skills_third_ieme')?.get('computersNetworks')?.value || ''
          },
          mcm_ter: {
            metrologia: this.form.get('wanted_skills_third_mcm')?.get('metrology')?.value || '',
            metalurgia: this.form.get('wanted_skills_third_mcm')?.get('metallurgy')?.value || '',
            soldaduraMcm: this.form.get('wanted_skills_third_mcm')?.get('weldingMcm')?.value || '',
            fresado: this.form.get('wanted_skills_third_mcm')?.get('milling')?.value || '',
            torno: this.form.get('wanted_skills_third_mcm')?.get('lathe')?.value || '',
            neumatica: this.form.get('wanted_skills_third_mcm')?.get('pneumatics')?.value || '',
            fabricacion: this.form.get('wanted_skills_third_mcm')?.get('manufacturingMcm')?.value || '',
            dibujoMcm: this.form.get('wanted_skills_third_mcm')?.get('drawingMcm')?.value || '',
            automatizacionMcm: this.form.get('wanted_skills_third_mcm')?.get('automationMcm')?.value || '',
            maquinasMcm: this.form.get('wanted_skills_third_mcm')?.get('machinesMcm')?.value || '',
            moldes: this.form.get('wanted_skills_third_mcm')?.get('molds')?.value || ''
          },
          ema_ter: {
            motores: this.form.get('wanted_skills_third_ema')?.get('engines')?.value || '',
            seguridad: this.form.get('wanted_skills_third_ema')?.get('safety')?.value || '',
            sistemasElectronicos: this.form.get('wanted_skills_third_ema')?.get('electronicSystems')?.value || '',
            sistemasElectricos: this.form.get('wanted_skills_third_ema')?.get('electricalSystems')?.value || '',
            dibujoEma: this.form.get('wanted_skills_third_ema')?.get('drawingEma')?.value || '',
            mantenimiento: this.form.get('wanted_skills_third_ema')?.get('maintenance')?.value || '',
            automotriz: this.form.get('wanted_skills_third_ema')?.get('automotive')?.value || '',
          },
          informatica_ter: {
            programacion: this.form.get('wanted_skills_third_inf')?.get('programming1')?.value || '',
            diseno: this.form.get('wanted_skills_third_inf')?.get('desing')?.value || '',
            cad: this.form.get('wanted_skills_third_inf')?.get('cad')?.value || '',
            soporte: this.form.get('wanted_skills_third_inf')?.get('support1')?.value || '',
            movil: this.form.get('wanted_skills_third_inf')?.get('mobile')?.value || '',
            web: this.form.get('wanted_skills_third_inf')?.get('web1')?.value || '',
            redes: this.form.get('wanted_skills_third_inf')?.get('networks1')?.value || ''
          },
          mecatronica_ter: {
            microcontroladores: this.form.get('wanted_skills_third_mec')?.get('microcontrollers')?.value || '',
            servomecanismos: this.form.get('wanted_skills_third_mec')?.get('servomechanisms')?.value || '',
            automatizacion: this.form.get('wanted_skills_third_mec')?.get('automation')?.value || '',
            dibujoMec: this.form.get('wanted_skills_third_mec')?.get('drawingMec')?.value || '',
            simulacion: this.form.get('wanted_skills_third_mec')?.get('simulation')?.value || '',
            programacionMec: this.form.get('wanted_skills_third_mec')?.get('programmingMec')?.value || '',
            soldadura: this.form.get('wanted_skills_third_mec')?.get('weldingMec')?.value || '',
            manufactura: this.form.get('wanted_skills_third_mec')?.get('manufacture')?.value || '',
            cnc: this.form.get('wanted_skills_third_mec')?.get('cnc')?.value || ''
          },
          ciecias_ter: {
            redaccionCreativa: this.form.get('wanted_skills_third_science')?.get('creativeWriting')?.value || '',
            dibujoCiencias: this.form.get('wanted_skills_third_science')?.get('drawingScience')?.value || '',
            investigacion: this.form.get('wanted_skills_third_science')?.get('research')?.value || '',
            biologia: this.form.get('wanted_skills_third_science')?.get('biology')?.value || '',
            morfologia: this.form.get('wanted_skills_third_science')?.get('morphology')?.value || '',
            sociologia: this.form.get('wanted_skills_third_science')?.get('sociology')?.value || '',
            politica: this.form.get('wanted_skills_third_science')?.get('politics')?.value || '',
            matematica: this.form.get('wanted_skills_third_science')?.get('mathematics')?.value || '',
            fisica: this.form.get('wanted_skills_third_science')?.get('physics')?.value || ''
          }
        },
        habilidad_ofrecida_seg: {
          ieme_seg_of: {
            instalacionesSeg: this.form.get('offer_skills_sec_ieme')?.get('installationsSec')?.value || '',
            electricidadSeg: this.form.get('offer_skills_sec_ieme')?.get('electricalEngSec')?.value || '',
            electronicaSeg: this.form.get('offer_skills_sec_ieme')?.get('electronicsSec')?.value || '',
            automatizacionSeg: this.form.get('offer_skills_sec_ieme')?.get('automationElecSec')?.value || ''
          },
          mcm_seg_of: {
            soldaduraMcmSeg: this.form.get('offer_skills_sec_mcm')?.get('weldingMcmSec')?.value || '',
            fresadoraSeg: this.form.get('offer_skills_sec_mcm')?.get('millingSec')?.value || '',
            tornoSeg: this.form.get('offer_skills_sec_mcm')?.get('latheSec')?.value || '',
            dibujoMcmSeg: this.form.get('offer_skills_sec_mcm')?.get('drawingMcmSec')?.value || '',
          },
          ema_seg_of: {
            sistemasSeg: this.form.get('offer_skills_sec_ema')?.get('systemSec')?.value || '',
            electronicaSeg: this.form.get('offer_skills_sec_ema')?.get('electronicSec')?.value || '',
            mantenimientoSeg: this.form.get('offer_skills_sec_ema')?.get('maintenanceSec')?.value || '',
          },
          mec_seg_of: {
            electronicaDigital: this.form.get('offer_skills_sec_mec')?.get('digitalElectronics')?.value || '',
            cncMecSeg: this.form.get('offer_skills_sec_mec')?.get('cncSec')?.value || '',
            manufacturaMecSeg: this.form.get('offer_skills_sec_mec')?.get('manufactureSec')?.value || '',
            automatizacionMecSeg: this.form.get('offer_skills_sec_mec')?.get('automationSystems')?.value || ''
          },
          informatica_seg_of: {
            programacion: this.form.get('offer_skills_sec_inf')?.get('programing')?.value || '',
            soporte: this.form.get('offer_skills_sec_inf')?.get('support')?.value || '',
            web: this.form.get('offer_skills_sec_inf')?.get('web')?.value || '',
            redes: this.form.get('offer_skills_sec_inf')?.get('networks')?.value || ''
          },
          ciencias_seg_of: {
            laboratorio: this.form.get('offer_skills_sec_sciences')?.get('lab')?.value || '',
            psicologia: this.form.get('offer_skills_sec_sciences')?.get('psychology')?.value || '',
            redaccionCreativaSeg: this.form.get('offer_skills_sec_sciences')?.get('creativeWritingSec')?.value || ''
          }
        },
        habilidad_ofrecida_ter: {
          ieme_ter_of: {
            electrotecnia: this.form.get('offer_skills_third_ieme')?.get('electricalEng')?.value || '',
            instalaciones: this.form.get('offer_skills_third_ieme')?.get('installations')?.value || '',
            automatismosEle: this.form.get('offer_skills_third_ieme')?.get('automationElec')?.value || '',
            electronica: this.form.get('offer_skills_third_ieme')?.get('electronics')?.value || '',
            potencia: this.form.get('offer_skills_third_ieme')?.get('power')?.value || '',
            maquinas: this.form.get('offer_skills_third_ieme')?.get('machines')?.value || '',
            industrial: this.form.get('offer_skills_third_ieme')?.get('industrial')?.value || '',
            microcontroladores: this.form.get('offer_skills_third_ieme')?.get('microcontrollersIeme')?.value || '',
            electronicaAplicada: this.form.get('offer_skills_third_ieme')?.get('appliedElectronics')?.value || '',
            comunicaciones: this.form.get('offer_skills_third_ieme')?.get('communications')?.value || '',
            redesComputadoras: this.form.get('offer_skills_third_ieme')?.get('computersNetworks')?.value || '',
          },
          mcm_ter_of: {
            metrologia: this.form.get('offer_skills_third_mcm')?.get('metrology')?.value || '',
            metalurgia: this.form.get('offer_skills_third_mcm')?.get('metallurgy')?.value || '',
            soldaduraMcm: this.form.get('offer_skills_third_mcm')?.get('weldingMcm')?.value || '',
            fresado: this.form.get('offer_skills_third_mcm')?.get('milling')?.value || '',
            torno: this.form.get('offer_skills_third_mcm')?.get('lathe')?.value || '',
            neumatica: this.form.get('offer_skills_third_mcm')?.get('pneumatics')?.value || '',
            fabricacion: this.form.get('offer_skills_third_mcm')?.get('manufacturingMcm')?.value || '',
            dibujoMcm: this.form.get('offer_skills_third_mcm')?.get('drawingMcm')?.value || '',
            automatizacionMcm: this.form.get('offer_skills_third_mcm')?.get('automationMcm')?.value || '',
            maquinasMcm: this.form.get('offer_skills_third_mcm')?.get('machinesMcm')?.value || '',
            moldes: this.form.get('offer_skills_third_mcm')?.get('molds')?.value || ''
          },
          ema_ter_of: {
            motores: this.form.get('offer_skills_third_ema')?.get('engines')?.value || '',
            seguridad: this.form.get('offer_skills_third_ema')?.get('safety')?.value || '',
            sistemasElectronicos: this.form.get('offer_skills_third_ema')?.get('electronicSystems')?.value || '',
            sistemasElectricos: this.form.get('offer_skills_third_ema')?.get('electricalSystems')?.value || '',
            dibujoEma: this.form.get('offer_skills_third_ema')?.get('drawingEma')?.value || '',
            mantenimiento: this.form.get('offer_skills_third_ema')?.get('maintenance')?.value || '',
            automotriz: this.form.get('offer_skills_third_ema')?.get('automotive')?.value || '',
          },
          mec_ter_of: {
            microcontroladores: this.form.get('offer_skills_third_mec')?.get('microcontrollers')?.value || '',
            servomecanismos: this.form.get('offer_skills_third_mec')?.get('servomechanisms')?.value || '',
            automatizacion: this.form.get('offer_skills_third_mec')?.get('automation')?.value || '',
            dibujoMec: this.form.get('offer_skills_third_mec')?.get('drawingMec')?.value || '',
            simulacion: this.form.get('offer_skills_third_mec')?.get('simulation')?.value || '',
            programacionMec: this.form.get('offer_skills_third_mec')?.get('programmingMec')?.value || '',
            soldadura: this.form.get('offer_skills_third_mec')?.get('weldingMec')?.value || '',
            manufactura: this.form.get('offer_skills_third_mec')?.get('manufacture')?.value || '',
            cnc: this.form.get('offer_skills_third_mec')?.get('cnc')?.value || ''
          },
          informatica_ter_of: {
            programacion: this.form.get('offer_skills_third_inf')?.get('programming1')?.value || '',
            diseno: this.form.get('offer_skills_third_inf')?.get('desing')?.value || '',
            cad: this.form.get('offer_skills_third_inf')?.get('cad')?.value || '',
            soporte: this.form.get('offer_skills_third_inf')?.get('support1')?.value || '',
            movil: this.form.get('offer_skills_third_inf')?.get('mobile')?.value || '',
            web: this.form.get('offer_skills_third_inf')?.get('web1')?.value || '',
            redes: this.form.get('offer_skills_third_inf')?.get('networks1')?.value || ''
          },
          ciencias_ter_of: {
            redaccionCreativa: this.form.get('offer_skills_third_sciences')?.get('creativeWriting')?.value || '',
            dibujoCiencias: this.form.get('offer_skills_third_sciences')?.get('drawingScience')?.value || '',
            investigacion: this.form.get('offer_skills_third_sciences')?.get('research')?.value || '',
            biologia: this.form.get('offer_skills_third_sciences')?.get('biology')?.value || '',
            morfologia: this.form.get('offer_skills_third_sciences')?.get('morphology')?.value || '',
            sociologia: this.form.get('offer_skills_third_sciences')?.get('sociology')?.value || '',
            politica: this.form.get('offer_skills_third_sciences')?.get('politics')?.value || '',
            matematica: this.form.get('offer_skills_third_sciences')?.get('mathematics')?.value || '',
            fisica: this.form.get('offer_skills_third_sciences')?.get('physics')?.value || ''
          }
        }
      };

      // Intentar crear/actualizar el documento en la colección específica primero
      const generalUserDoc = doc(this._firestore, 'usuarios', currentUser.uid);
      const userSnap = await getDoc(generalUserDoc);

      if (!userSnap.exists()) {
        throw new Error('Usuario no encontrado');
      }

      const { carrera } = userSnap.data();
      const collectionName = carrera.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "");

      console.log('Guardando en colección:', collectionName);

      // Guardar en la colección específica
      const carreraDoc = doc(this._firestore, collectionName, currentUser.uid);
      await setDoc(carreraDoc, formData, { merge: true });

      // Actualizar el estado de completitud
      await updateDoc(generalUserDoc, {
        formCompleted: true
      });

      console.log('Datos guardados exitosamente');
      //console.log(formData);
      this._router.navigateByUrl('/menu/recomendados');

    } catch (error) {
      console.error('Error en submit:', error);
    } finally {
      this.loading.set(false);
    }
  }

  private getSelectedHorario(): string[] {
    const schedule = this.form.get('schedule')?.value;
    const horario: string[] = [];
    if (schedule?.Q1O1) horario.push('durante_almuerzo');
    if (schedule?.Q1O2) horario.push('despues_clases');
    if (schedule?.Q1O3) horario.push('manana_fines');
    if (schedule?.Q1O4) horario.push('tarde_fines');
    return horario;
  }

  private getSelectedCarreras(): string[] {
    const professions = this.form.get('wanted_profession')?.value;
    const carreras: string[] = [];
    if (professions?.O1) carreras.push('ieme');
    if (professions?.O2) carreras.push('mcm');
    if (professions?.O3) carreras.push('ema');
    if (professions?.O4) carreras.push('mecatronica');
    if (professions?.O5) carreras.push('informatica');
    if (professions?.O6) carreras.push('ciencias');
    return carreras;
  }

  private processSchedule(schedule: any): string[] {
    const horario = [];
    if (schedule?.Q1O1) horario.push('durante_almuerzo');
    if (schedule?.Q1O2) horario.push('despues_clases');
    if (schedule?.Q1O3) horario.push('manana_fines');
    if (schedule?.Q1O4) horario.push('tarde_fines');
    return horario;
  }

  private processCarreras(carreras: any): string[] {
    const carrerasBuscadas = [];
    if (carreras?.O1) carrerasBuscadas.push('ieme');
    if (carreras?.O2) carrerasBuscadas.push('mcm');
    if (carreras?.O3) carrerasBuscadas.push('ema');
    if (carreras?.O4) carrerasBuscadas.push('mecatronica');
    if (carreras?.O5) carrerasBuscadas.push('informatica');
    if (carreras?.O6) carrerasBuscadas.push('ciencias');
    return carrerasBuscadas;
  }

  async ngOnInit() {
    try {
      // Obtener el usuario actual
      const currentUser = this._auth.currentUser;
      if (!currentUser) {
        this._router.navigate(['/login']);
        return;
      }

      // Obtener los datos del usuario
      this.userData = await this._registerService.getUserData(currentUser.uid);
    } catch (error) {
      console.error('Error al cargar datos del perfil:', error);
    }
  }

  isPageComplete(page: number): boolean {
    console.log('Verificando compleción de página:', page);
    
    const result = (() => {
      switch (page) {
        case 1:
          const prefComplete = this.isPreferencesComplete();
          console.log('Página 1 (Preferencias) completa:', prefComplete);
          return prefComplete;
        case 2:
          const profComplete = this.isWantedProfessionComplete();
          console.log('Página 2 (Profesión deseada) completa:', profComplete);
          return profComplete;
        case 3:
          const skillsComplete = this.isWantedSkillsComplete();
          console.log('Página 3 (Habilidades buscadas) completa:', skillsComplete);
          return skillsComplete;
        case 4:
          const offerComplete = this.isOfferSkillsComplete();
          console.log('Página 4 (Habilidades ofrecidas) completa:', offerComplete);
          return offerComplete;
        default:
          console.log('Página desconocida:', page);
          return false;
      }
    })();
    
    console.log('Resultado final para página', page, ':', result);
    return result;
  }

  private isPreferencesComplete(): boolean {
    const scheduleGroup = this.form.get('schedule');
    const methodControl = this.form.get('method');
    const hoursControl = this.form.get('hours');

    // Verifica que schedule tenga al menos una opción seleccionada
    const scheduleValid = scheduleGroup ? !scheduleGroup.hasError('requireCheckbox') : false;

    // Verifica que method y hours tengan valores, con conversión explícita a boolean
    const methodValid = Boolean(methodControl?.value) && Boolean(methodControl?.valid);
    const hoursValid = Boolean(hoursControl?.value) && Boolean(hoursControl?.valid);

    return scheduleValid && methodValid && hoursValid;
  }


  private isWantedProfessionComplete(): boolean {
    const wantedProfessionGroup = this.form.get('wanted_profession');
    return wantedProfessionGroup ? !wantedProfessionGroup.hasError('requireCheckbox') : false;
  }

  private isWantedSkillsComplete(): boolean {
    const selectedProfessions = this.form.get('wanted_profession')?.value;
    if (!selectedProfessions) return false;

    let allValid = true;

    // IEME
    if (selectedProfessions.O1) {
      const groupName = this.userData?.anioLectivo === 'Segundo' ? 'wanted_skills_sec_ieme' : 'wanted_skills_third_ieme';
      const group = this.form.get(groupName);
      if (!group || !this.areAllFieldsInGroupFilled(group)) {
        allValid = false;
      }
    }

    // MCM
    if (selectedProfessions.O2) {
      const groupName = this.userData?.anioLectivo === 'Segundo' ? 'wanted_skills_sec_mcm' : 'wanted_skills_third_mcm';
      const group = this.form.get(groupName);
      if (!group || !this.areAllFieldsInGroupFilled(group)) {
        allValid = false;
      }
    }

    // EMA
    if (selectedProfessions.O3) {
      const groupName = this.userData?.anioLectivo === 'Segundo' ? 'wanted_skills_sec_ema' : 'wanted_skills_third_ema';
      const group = this.form.get(groupName);
      if (!group || !this.areAllFieldsInGroupFilled(group)) {
        allValid = false;
      }
    }

    // Mecatrónica
    if (selectedProfessions.O4) {
      const groupName = this.userData?.anioLectivo === 'Segundo' ? 'wanted_skills_sec_mec' : 'wanted_skills_third_mec';
      const group = this.form.get(groupName);
      if (!group || !this.areAllFieldsInGroupFilled(group)) {
        allValid = false;
      }
    }

    // Informática
    if (selectedProfessions.O5) {
      const groupName = this.userData?.anioLectivo === 'Segundo' ? 'wanted_skills_sec_inf' : 'wanted_skills_third_inf';
      const group = this.form.get(groupName);
      if (!group || !this.areAllFieldsInGroupFilled(group)) {
        allValid = false;
      }
    }

    // Ciencias
    if (selectedProfessions.O6) {
      const groupName = this.userData?.anioLectivo === 'Segundo' ? 'wanted_skills_sec_science' : 'wanted_skills_third_science';
      const group = this.form.get(groupName);
      if (!group || !this.areAllFieldsInGroupFilled(group)) {
        allValid = false;
      }
    }

    return allValid;
  }

  // Método auxiliar para verificar que todos los campos en un grupo tengan valor
  private areAllFieldsInGroupFilled(group: AbstractControl): boolean {
    if (!(group instanceof FormGroup)) return false;
    
    return Object.keys(group.controls).every(key => {
      const control = group.get(key);
      return control?.value !== '' && control?.value !== null && control?.value !== undefined;
    });
  }


  private isOfferSkillsComplete(): boolean {
    if (!this.userData?.carrera) return false;
  
    const groupPrefix = this.userData.anioLectivo === 'Segundo' ? 'offer_skills_sec_' : 'offer_skills_third_';
    let groupSuffix = '';
  
    switch (this.userData.carrera) {
      case 'Informatica': groupSuffix = 'inf'; break;
      case 'IEME': groupSuffix = 'ieme'; break;
      case 'MCM': groupSuffix = 'mcm'; break;
      case 'EMA': groupSuffix = 'ema'; break;
      case 'Mecatronica': groupSuffix = 'mec'; break;
      case 'Ciencias': groupSuffix = 'sciences'; break;
      default: return false;
    }
  
    const groupName = groupPrefix + groupSuffix;
    const group = this.form.get(groupName);
    
    // Debug: Veamos qué contiene el grupo
    console.log('Grupo validando:', groupName);
    console.log('Contenido del grupo:', group?.value);
    
    // Si el grupo no existe, retornamos false
    if (!group) {
      console.log('Grupo no encontrado:', groupName);
      return false;
    }
    
    // Ahora usemos una lógica más simple para validación inicial
    // Consideremos la página como válida si el grupo no tiene errores
    if (group.valid) {
      console.log('Grupo válido:', groupName);
      return true;
    }
    
    console.log('Grupo inválido:', groupName, 'Errores:', group.errors);
    
    // Si llegamos aquí, el grupo tiene errores
    return false;
  }

  get isLastPage(): boolean {
    return this.page === 4;
  }
}