import { Injectable } from '@nestjs/common';

/**
 * Arma el JSON que espera MiFact a partir de una factura del sistema.
 * Caso transporte: ítems "flete" afectos a IGV 18%, con detracción 4% (código 027)
 * cuando el total supera el umbral. La detracción se calcula sobre el MAYOR entre
 * el total y el valor referencial, redondeada a soles enteros (regla confirmada con
 * una factura real de producción y validada en el demo).
 */

export interface EmisorMap {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  ubigeo: string;
  direccionFiscal: string;
  codAnexo?: string;
  puntoVenta?: string;
  ctaDetraccion?: string;
  porcDetraccion?: number;
  codDetraccion?: string;
  umbralDetraccion?: number;
  correoEnvio?: string;
  formatoImpresion?: string; // COD_FORM_IMPR: formato del PDF en MiFact (p. ej. 001, o el personalizado)
  cuentas?: { banco?: string; moneda?: string; numero?: string; cci?: string }[]; // cuentas bancarias para el pago
}
export interface ItemMap {
  descripcion: string;
  cantidad: number;
  valorUnitario: number; // sin IGV
  afectacion?: string; // 10 gravado
  unidad?: string; // ZZ servicios
}
export interface FacturaMap {
  tipoDocCodigo: string; // 01 · 03 · 07 · 08
  serie: string;
  correlativo: string;
  fecha: string; // YYYY-MM-DD
  moneda?: string;
  tipoCambio?: number;
  cliente: string;
  ruc?: string;
  direccion?: string;
  items: ItemMap[];
  valorReferencial?: number;
  ubigeoOrigen?: string;
  ubigeoDestino?: string;
  detalleViaje?: string;
  formaPago?: string; // Contado | Credito
  fechaVencimiento?: string | null;
  codTipNc?: string;
  motivo?: string;
  referencia?: string; // referencia / N° de orden de compra
  guia?: string; // guía de remisión del remitente referenciada (SERIE-CORRELATIVO)
  guiaTransportista?: string; // guía de remisión del transportista referenciada (SERIE-CORRELATIVO)
  docRefTipo?: string;
  docRefSerie?: string;
  docRefCorrelativo?: string;
}

const IGV = 0.18;
const r2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => r2(n).toFixed(2);

@Injectable()
export class MifactMapper {
  // 1 = DNI (8 dígitos), 6 = RUC (11). Por defecto RUC.
  private tipoNif(doc: string): string {
    return (doc || '').trim().length === 8 ? '1' : '6';
  }

  private itemsPayload(items: ItemMap[]) {
    return items.map((it, i) => {
      const cant = it.cantidad || 1;
      const vu = it.valorUnitario || 0;
      const valVenta = r2(vu * cant);
      const igv = r2(valVenta * IGV);
      return {
        COD_ITEM: `IT${i + 1}`,
        COD_UNID_ITEM: it.unidad || 'ZZ',
        CANT_UNID_ITEM: String(cant),
        VAL_UNIT_ITEM: String(vu),
        PRC_VTA_UNIT_ITEM: money(vu * (1 + IGV)),
        VAL_VTA_ITEM: money(valVenta),
        MNT_BRUTO: money(valVenta),
        MNT_PV_ITEM: money(valVenta * (1 + IGV)),
        COD_TIP_PRC_VTA: '01',
        COD_TIP_AFECT_IGV_ITEM: it.afectacion || '10',
        COD_TRIB_IGV_ITEM: '1000',
        POR_IGV_ITEM: '18',
        MNT_IGV_ITEM: money(igv),
        TXT_DESC_ITEM: it.descripcion || 'SERVICIO DE TRANSPORTE',
      };
    });
  }

  private totales(items: ItemMap[]) {
    const gravado = r2(items.reduce((s, it) => s + (it.valorUnitario || 0) * (it.cantidad || 1), 0));
    const igv = r2(gravado * IGV);
    return { gravado, igv, total: r2(gravado + igv) };
  }

  /** Payload de emisión (SendInvoice) + los montos calculados para persistir. */
  sendInvoice(f: FacturaMap, e: EmisorMap) {
    const { gravado, igv, total } = this.totales(f.items);
    const umbral = e.umbralDetraccion ?? 700;
    const codDetr = e.codDetraccion || '027';
    const porc = e.porcDetraccion ?? 4;
    const esCarga = f.tipoDocCodigo === '01' || f.tipoDocCodigo === '03';
    const sujetoDetraccion = esCarga && !!codDetr && total > umbral;
    const base = Math.max(total, f.valorReferencial || 0);
    const montoDetraccion = sujetoDetraccion ? Math.round(base * (porc / 100)) : 0; // soles enteros

    const p: Record<string, any> = {
      COD_TIP_NIF_EMIS: '6',
      NUM_NIF_EMIS: e.ruc,
      NOM_RZN_SOC_EMIS: e.razonSocial,
      NOM_COMER_EMIS: e.nombreComercial || e.razonSocial,
      COD_UBI_EMIS: e.ubigeo,
      TXT_DMCL_FISC_EMIS: e.direccionFiscal,
      COD_ANEXO_EMIS: e.codAnexo || '0000',
      COD_TIP_NIF_RECP: this.tipoNif(f.ruc || ''),
      NUM_NIF_RECP: f.ruc || '',
      NOM_RZN_SOC_RECP: f.cliente,
      TXT_DMCL_FISC_RECEP: f.direccion || '-',
      FEC_EMIS: f.fecha,
      COD_TIP_CPE: f.tipoDocCodigo,
      NUM_SERIE_CPE: f.serie,
      NUM_CORRE_CPE: f.correlativo,
      COD_MND: f.moneda || 'PEN',
      MNT_TOT_GRAVADO: money(gravado),
      MNT_TOT_TRIB_IGV: money(igv),
      MNT_TOT: money(total),
      COD_PTO_VENTA: e.puntoVenta || 'SISTEMA',
      ENVIAR_A_SUNAT: 'true',
      RETORNA_XML_ENVIO: 'true',
      RETORNA_XML_CDR: 'true',
      RETORNA_PDF: 'true',
      COD_FORM_IMPR: e.formatoImpresion || '001',
      TXT_VERS_UBL: '2.1',
      TXT_VERS_ESTRUCT_UBL: '2.0',
      COD_TIP_OPE_SUNAT: sujetoDetraccion ? '1004' : '0101',
      items: this.itemsPayload(f.items),
    };

    if ((f.moneda || 'PEN') !== 'PEN' && f.tipoCambio) p.TIP_CAMBIO = String(f.tipoCambio);
    if (e.correoEnvio) p.TXT_CORREO_ENVIO = e.correoEnvio;
    // Crédito: fecha de vencimiento + 1 cuota por el total (representación UBL que espera MiFact).
    if ((f.formaPago || 'Contado') === 'Credito' && f.fechaVencimiento) {
      p.FEC_VENCIMIENTO = f.fechaVencimiento;
      p.cuotas = [{ NRO_CUOTA: '1', FECHA_CUOTA: f.fechaVencimiento, MONTO_CUOTA: money(total) }];
    }

    if (sujetoDetraccion) {
      p.MNT_TOT_DETRACCION = money(montoDetraccion);
      p.POR_DETRACCION = porc.toFixed(2);
      p.NRO_CUENTA_DETRAC = e.ctaDetraccion || '';
      p.COD_TIP_DETRACCION = codDetr;
      p.MNT_PENDIENTE = money(r2(total - montoDetraccion));
      const vr = money(f.valorReferencial || 0);
      p.transporte = [
        {
          COD_UBI_PRTD: f.ubigeoOrigen || '',
          TXT_DMCL_FISC_PRTD: '-',
          COD_UBI_LLGD: f.ubigeoDestino || '',
          TXT_DMCL_FISC_LLGD: '-',
          DETALLE_VIAJE: f.detalleViaje || 'SERVICIO DE TRANSPORTE DE CARGA',
          VALOR_REF_SERV_TRANSP: vr,
          VALOR_REF_CARGA_EFECT: vr,
          VALOR_REF_CARGA_UTIL: vr,
        },
      ];
    }

    if (f.tipoDocCodigo === '07' || f.tipoDocCodigo === '08') {
      if (f.tipoDocCodigo === '07') p.COD_TIP_NC = f.codTipNc || '01';
      else p.COD_TIP_ND = f.codTipNc || '01';
      p.TXT_DESC_MTVO = f.motivo || 'AJUSTE';
      p.docs_referenciado = [
        {
          COD_TIP_DOC_REF: f.docRefTipo || '01',
          NUM_SERIE_CPE_REF: f.docRefSerie || '',
          NUM_CORRE_CPE_REF: f.docRefCorrelativo || '',
          FEC_DOC_REF: f.fecha,
        },
      ];
    }

    // Observaciones / leyendas que deben SALIR en el comprobante (SUNAT datos adicionales).
    const adic: Record<string, string>[] = [];
    if ((f.formaPago || 'Contado') === 'Credito' && f.fechaVencimiento) {
      const dias = Math.max(0, Math.round((new Date(f.fechaVencimiento).getTime() - new Date(f.fecha).getTime()) / 86_400_000));
      adic.push({ COD_TIP_ADIC_SUNAT: '01', TXT_DESC_ADIC_SUNAT: `CREDITO ${dias} DIAS - 01 CUOTA` });
    }
    // Cuentas bancarias de la sede → como observación, para que el cliente pueda pagar.
    for (const cta of e.cuentas || []) {
      const nro = (cta.numero || '').trim();
      if (!nro) continue;
      const linea = `${(cta.banco || '').trim()} ${(cta.moneda || '').trim()} - Cta ${nro}${cta.cci && cta.cci.trim() ? ` / CCI ${cta.cci.trim()}` : ''}`.replace(/\s+/g, ' ').trim();
      adic.push({ COD_TIP_ADIC_SUNAT: '05', TXT_DESC_ADIC_SUNAT: linea });
    }
    if (adic.length) p.datos_adicionales = adic;
    // Orden de compra / pedido → columna dedicada del comprobante.
    if (f.referencia && f.referencia.trim()) {
      p.otro_docs_referenciado = [{ COD_TIP_OTR_DOC_REF: '99', NUM_OTR_DOC_REF: f.referencia.trim() }];
    }
    // Guías de remisión referenciadas → columna "Guía" (formato SERIE-CORRELATIVO, p. ej. T002-1668).
    // Se referencian tanto la del remitente como la del transportista, si vienen.
    const guias: Record<string, string>[] = [];
    for (const g of [f.guia, f.guiaTransportista]) {
      if (!g || !g.trim()) continue;
      const [s, ...rest] = g.trim().split('-');
      const c = rest.join('').replace(/\D/g, '');
      if (s && c) guias.push({ COD_TIP_DOC_REF: '09', NUM_SERIE_CPE_REF: s.trim(), NUM_CORRE_CPE_REF: c.padStart(8, '0') });
    }
    if (guias.length) p.guias = guias;

    return { payload: p, calc: { gravado, igv, total, sujetoDetraccion, montoDetraccion } };
  }

  // Clave del comprobante para consultar / anular / PDF / correo.
  private clave(f: FacturaMap, e: EmisorMap) {
    return {
      NUM_NIF_EMIS: e.ruc,
      COD_TIP_CPE: f.tipoDocCodigo,
      NUM_SERIE_CPE: f.serie,
      NUM_CORRE_CPE: f.correlativo,
      FEC_EMIS: f.fecha,
    };
  }
  getEstatus(f: FacturaMap, e: EmisorMap) {
    return this.clave(f, e);
  }
  getInvoice(f: FacturaMap, e: EmisorMap, opts: { pdf?: boolean; cdr?: boolean } = {}) {
    return { ...this.clave(f, e), RETORNA_PDF: opts.pdf ? 'true' : 'false', RETORNA_XML_CDR: opts.cdr ? 'true' : 'false', COD_FORM_IMPR: e.formatoImpresion || '001' };
  }
  lowInvoice(f: FacturaMap, e: EmisorMap, motivo: string) {
    return { COD_TIP_NIF_EMIS: '6', ...this.clave(f, e), TXT_DESC_MTVO: motivo || 'ANULACION', COD_PTO_VENTA: e.puntoVenta || 'SISTEMA' };
  }
  sendMail(f: FacturaMap, e: EmisorMap, correo: string) {
    return { ...this.clave(f, e), TXT_CORREO_ENVIO: correo };
  }
}
