import { Injectable, BadRequestException } from '@nestjs/common';
import {
  ANEXO_I_LOCAL,
  ANEXO_II_NACIONAL,
  TARIFAS_VIGENCIA,
  type ZonaLocal,
} from './tarifas-referenciales.data';

/**
 * Calcula el VALOR REFERENCIAL del transporte de carga según el DS 022-2025-MTC,
 * usado como base alterna de la detracción (SPOT): la detracción es 4% sobre el
 * MAYOR entre el importe de la operación y este valor referencial.
 *
 *  - Ámbito NACIONAL (provincia): valor referencial = (S/ x TM de la ruta/destino) × peso en TM.
 *  - Ámbito LOCAL (operativos en puerto):
 *      · contenedores llenos/vacíos → tarifa por VIAJE (no se multiplica por el peso).
 *      · carga general / graneles   → tarifa por TONELADA × peso en TM.
 *
 * Las tablas viven en tarifas-referenciales.data.ts (Anexos I y II del DS).
 */

export type TipoCargaLocal =
  | 'contenedorLleno'
  | 'contenedorVacio'
  | 'cargaGeneral'
  | 'granelAlimentos'
  | 'granelMinerales';

export interface CalcInput {
  ambito: 'local' | 'nacional';
  pesoTM?: number;
  // nacional
  ruta?: string;
  destino?: string;
  // local
  puerto?: string;
  zona?: string;
  tipoCarga?: TipoCargaLocal;
}

export interface CalcResult {
  valorReferencial: number; // S/
  base: 'viaje' | 'tonelada';
  tarifa: number; // S/ por viaje o por TM
  pesoTM: number;
  detalle: string;
  vigencia: string;
}

const TIPOS_CARGA: { key: TipoCargaLocal; etiqueta: string; porViaje: boolean }[] = [
  { key: 'contenedorLleno', etiqueta: 'Contenedor lleno', porViaje: true },
  { key: 'contenedorVacio', etiqueta: 'Contenedor vacío', porViaje: true },
  { key: 'cargaGeneral', etiqueta: 'Carga general y líquidos', porViaje: false },
  { key: 'granelAlimentos', etiqueta: 'Graneles: alimentos, cisternas y otros', porViaje: false },
  { key: 'granelMinerales', etiqueta: 'Graneles: minerales y fertilizantes', porViaje: false },
];

const r2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class ValorReferencialService {
  /** Catálogos para la UI: puertos+zonas, rutas+destinos y tipos de carga. */
  meta() {
    return {
      vigencia: TARIFAS_VIGENCIA,
      tiposCarga: TIPOS_CARGA.map((t) => ({ key: t.key, etiqueta: t.etiqueta, porViaje: t.porViaje })),
      puertos: ANEXO_I_LOCAL.map((p) => ({ puerto: p.puerto, zonas: p.zonas.map((z) => z.zona) })),
      rutas: ANEXO_II_NACIONAL.map((r) => ({ ruta: r.ruta, destinos: r.destinos })),
    };
  }

  calcular(input: CalcInput): CalcResult {
    const pesoTM = Number(input.pesoTM || 0);
    if (input.ambito === 'nacional') return this.nacional(input, pesoTM);
    if (input.ambito === 'local') return this.local(input, pesoTM);
    throw new BadRequestException('Ámbito inválido (usa "local" o "nacional").');
  }

  private nacional(input: CalcInput, pesoTM: number): CalcResult {
    const ruta = ANEXO_II_NACIONAL.find((r) => r.ruta === input.ruta);
    if (!ruta) throw new BadRequestException('Ruta nacional no encontrada.');
    const dest = ruta.destinos.find((d) => d.destino === input.destino);
    if (!dest) throw new BadRequestException('Destino no encontrado en la ruta.');
    if (pesoTM <= 0) throw new BadRequestException('Indica el peso transportado en toneladas (TM).');
    const valorReferencial = r2(dest.sxTM * pesoTM);
    return {
      valorReferencial,
      base: 'tonelada',
      tarifa: dest.sxTM,
      pesoTM,
      detalle: `${ruta.ruta} — ${dest.destino}: S/ ${dest.sxTM.toFixed(2)}/TM × ${pesoTM} TM`,
      vigencia: TARIFAS_VIGENCIA,
    };
  }

  private local(input: CalcInput, pesoTM: number): CalcResult {
    const puerto = ANEXO_I_LOCAL.find((p) => p.puerto === input.puerto);
    if (!puerto) throw new BadRequestException('Puerto no encontrado.');
    const zona = puerto.zonas.find((z) => z.zona === input.zona);
    if (!zona) throw new BadRequestException('Zona no encontrada para el puerto.');
    const tc = TIPOS_CARGA.find((t) => t.key === input.tipoCarga);
    if (!tc) throw new BadRequestException('Tipo de carga inválido.');
    const tarifa = (zona as ZonaLocal)[tc.key];
    if (tc.porViaje) {
      return {
        valorReferencial: r2(tarifa),
        base: 'viaje',
        tarifa,
        pesoTM,
        detalle: `${puerto.puerto} — ${zona.zona} — ${tc.etiqueta}: S/ ${tarifa.toFixed(2)} por viaje`,
        vigencia: TARIFAS_VIGENCIA,
      };
    }
    if (pesoTM <= 0) throw new BadRequestException('Indica el peso transportado en toneladas (TM).');
    return {
      valorReferencial: r2(tarifa * pesoTM),
      base: 'tonelada',
      tarifa,
      pesoTM,
      detalle: `${puerto.puerto} — ${zona.zona} — ${tc.etiqueta}: S/ ${tarifa.toFixed(2)}/TM × ${pesoTM} TM`,
      vigencia: TARIFAS_VIGENCIA,
    };
  }
}
