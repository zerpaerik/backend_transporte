import { Injectable } from '@nestjs/common';

/**
 * Arma el JSON de la Guía de Remisión electrónica del TRANSPORTISTA (COD_TIP_GUR 31)
 * para MiFact (SendGuia), a partir de los datos del viaje + el emisor.
 *
 * Basado en los ejemplos oficiales del repo de MiFact (Remisión Transportista, UBL
 * 2.0-2023) y en guías reales de producción. Nota: SUNAT no tiene demo de GRE.
 *
 * El peso y la mercadería pueden venir vacíos: según el flujo del cliente, al
 * referenciar la GRR del remitente SUNAT completa esos datos. Igual se aceptan como
 * entrada por si hay que enviarlos (a confirmar con MiFact).
 */

export interface GreEmisor {
  registroMtc?: string;
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  ubigeo: string;
  direccionFiscal: string;
  puntoVenta?: string;
}
export interface GreParte {
  ruc?: string;
  razonSocial?: string;
}
export interface GreConductor {
  nombre: string;
  dni?: string;
  licencia?: string;
}
export interface GreItem {
  descripcion: string;
  cantidad?: number;
  peso?: number;
  unidad?: string;
}
export type PagadorFlete = 'remitente' | 'tercero' | 'subcontratado';
export interface GreInput {
  serie: string;
  correlativo: string;
  fechaEmision: string; // YYYY-MM-DD
  fechaTraslado: string; // YYYY-MM-DD
  partidaDir: string;
  partidaUbigeo: string;
  llegadaDir: string;
  llegadaUbigeo: string;
  remitente: GreParte;
  destinatario?: GreParte; // por defecto = remitente
  conductor: GreConductor;
  placaTracto: string;
  tucTracto?: string;
  placaCarreta?: string;
  tucCarreta?: string;
  pesoBruto?: number | string;
  unidad?: string; // KGM
  items?: GreItem[];
  docRefTipo?: string; // 09 GRR · 01 factura
  docRefNumero?: string; // p. ej. EG07-4763 o F001-00000002
  pagadorFlete?: PagadorFlete;
  tercero?: GreParte; // empresa que subcontrata / paga el flete (si no es el remitente)
  trasladoTotal?: boolean;
  observaciones?: string;
}

@Injectable()
export class GreMapper {
  sendGuia(g: GreInput, e: GreEmisor) {
    const dest = g.destinatario && (g.destinatario.ruc || g.destinatario.razonSocial) ? g.destinatario : g.remitente;
    const pagador: PagadorFlete = g.pagadorFlete || 'remitente';
    // El vehículo secundario (carreta) no tiene aún un campo estructurado confirmado en
    // el JSON de MiFact; se anota en observaciones para no perderlo (pendiente confirmar).
    const obs = [
      g.observaciones,
      g.placaCarreta ? `Vehiculo secundario: ${g.placaCarreta}${g.tucCarreta ? ` (TUC ${g.tucCarreta})` : ''}` : '',
    ].filter(Boolean).join(' | ') || 'ninguna observacion';

    const p: Record<string, any> = {
      INDICADOR_PAGADOR_FLETE_REMITENTE: pagador === 'remitente' ? '1' : '0',
      INDICADOR_TRASLADO_TOTAL_BIENES: g.trasladoTotal === false ? '0' : '1',
      INDICADOR_TRASLADO_SUB_CONTRATADO: pagador === 'subcontratado' ? '1' : '0',
      INDICADOR_PAGADOR_FLETE_SUB_CONTRATADOR: pagador === 'subcontratado' ? '1' : '0',
      INDICADOR_PAGADOR_FLETE_TERCERO: pagador === 'tercero' ? '1' : '0',
      NRO_REGISTRO_MTC: e.registroMtc || '',
      TXT_VERS_UBL: '2.1',
      TXT_VERS_ESTRUCT_UBL: '2.0',
      RETORNA_XML_ENVIO: false,
      RETORNA_XML_CDR: true,
      OBSERVACIONES: obs,
      COD_TIP_NIF_EMIS: '6',
      NUM_NIF_EMIS: e.ruc,
      NOM_COMER_EMIS: e.nombreComercial || e.razonSocial,
      TXT_DMCL_FISC_EMIS: e.direccionFiscal,
      NOM_RZN_SOC_EMIS: e.razonSocial,
      COD_UBI_EMIS: e.ubigeo,
      COD_TIP_GUR: '31',
      NUM_SERIE_GUR: g.serie,
      NUM_CORRE_GUR: g.correlativo,
      COD_PRCD_CARGA: '001',
      FEC_EMIS_GUR: g.fechaEmision,
      FEC_TRASLADO: g.fechaTraslado,
      DIR_PARTIDA: g.partidaDir,
      UBI_PARTIDA: g.partidaUbigeo,
      DIR_LLEGADA: g.llegadaDir,
      UBI_LLEGADA: g.llegadaUbigeo,
      COD_TIP_NIF_DEST: '6',
      NOM_RZN_SOC_DEST: dest.razonSocial || '',
      NUM_NIF_DEST: dest.ruc || '',
      COD_TIP_NIF_REMIT: '6',
      NOM_RZN_SOC_REMITENTE: g.remitente.razonSocial || '',
      NUM_NIF_REMITENTE: g.remitente.ruc || '',
      NRO_LICENCIA_CONDUCT: g.conductor.licencia || '',
      COD_TIP_NIF_CONDUCT: '1',
      NUM_NIF_CONDUCT: g.conductor.dni || '',
      NOM_RZN_SOC_CONDUCT: g.conductor.nombre,
      PLACA: g.placaTracto,
      IND_TRANSBORDO: false,
      UND_MEDIDA: g.unidad || 'KGM',
      PESO_BRUTO: g.pesoBruto != null ? String(g.pesoBruto) : '',
      CONSTANCIA_VEHICULAR_TUC: g.tucTracto || '',
      ENTIDAD_EMISORA_AUT_TRANSPORTISTA: '',
      NRO_AUTORIZACION_ESPECIAL_EMISORA: '',
      ENTIDAD_EMISORA_AUT_VEHICULO: '',
      NRO_AUTORIZACION_ESPECIAL_VEHICULO: '',
      // Empresa que subcontrata / paga el flete (solo si no es el remitente).
      COD_TIP_NIF_TRANSP: pagador !== 'remitente' && g.tercero?.ruc ? '6' : '',
      NUM_NIF_TRANSP: pagador !== 'remitente' ? g.tercero?.ruc || '' : '',
      NOM_RZN_SOC_TRANSP: pagador !== 'remitente' ? g.tercero?.razonSocial || '' : '',
      items: (g.items || []).map((it, i) => ({
        CANT_ITEM: it.cantidad ?? 1,
        COD_ITEM: `P${String(i + 1).padStart(4, '0')}`,
        DESC_ITEM: it.descripcion,
        PESO_ITEM: it.peso ?? 0,
        COD_UND_MEDIDA_ITEM: it.unidad || 'NIU',
        NUM_LINEA: i + 1,
      })),
      docs_referenciado: g.docRefNumero ? [{ COD_TIP_DOC_REF: g.docRefTipo || '09', NUM_DOC_REF: g.docRefNumero }] : [],
    };
    return p;
  }

  private clave(g: { serie: string; correlativo: string; fechaEmision: string }, e: GreEmisor) {
    return {
      NUM_NIF_EMIS: e.ruc,
      COD_TIP_GUR: '31',
      NUM_SERIE_GUR: g.serie,
      NUM_CORRE_GUR: g.correlativo,
      FEC_EMIS_GUR: g.fechaEmision,
    };
  }
  getEstatus(g: { serie: string; correlativo: string; fechaEmision: string }, e: GreEmisor) {
    return this.clave(g, e);
  }
  getGuia(g: { serie: string; correlativo: string; fechaEmision: string }, e: GreEmisor, opts: { pdf?: boolean } = {}) {
    return { ...this.clave(g, e), RETORNA_PDF: opts.pdf ? 'true' : 'false', RETORNA_XML_CDR: 'true' };
  }
  // OJO: LowGuia solo marca la baja en el portal de MiFact; la anulación real ante
  // SUNAT se hace desde la Clave SOL (ningún PSE/OSE puede anular guías).
  lowGuia(g: { serie: string; correlativo: string; fechaEmision: string }, e: GreEmisor, motivo: string) {
    return { ...this.clave(g, e), TXT_MTVO_BAJA: motivo || 'ERROR EN EMISION', COD_PTO_VENTA: e.puntoVenta || 'SISTEMA' };
  }
  sendMail(g: { serie: string; correlativo: string; fechaEmision: string }, e: GreEmisor, correo: string) {
    return { ...this.clave(g, e), TXT_CORREO_ENVIO: correo };
  }
}
