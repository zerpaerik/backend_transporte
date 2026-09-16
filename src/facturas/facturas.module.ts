import { Module, Injectable, NotFoundException, BadRequestException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsNotEmpty, Min, ValidateNested } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, JwtUser } from '../common/decorators';
import { FacturacionElectronicaModule } from '../facturacion-electronica/facturacion-electronica.module';
import { MifactClient } from '../facturacion-electronica/mifact.client';
import { MifactConfigService } from '../facturacion-electronica/mifact-config.service';
import { CorrelativosService } from '../facturacion-electronica/correlativos.service';
import { MifactMapper, type FacturaMap, type ItemMap } from '../facturacion-electronica/mifact.mapper';
import { ValorReferencialService } from '../facturacion-electronica/valor-referencial.service';

const TIPO_COD: Record<string, string> = { Factura: '01', Boleta: '03', 'N. Crédito': '07' };

class ItemDto {
  @IsString() @IsNotEmpty() descripcion: string;
  @IsNumber() @Min(0) @IsOptional() cantidad?: number;
  @IsNumber() @Min(0) valorUnitario: number;
  @IsString() @IsOptional() afectacion?: string;
  @IsString() @IsOptional() unidad?: string;
}

class CreateFacturaDto {
  @IsString() @IsOptional() serie?: string;
  @IsIn(['Factura', 'Boleta', 'N. Crédito']) tipo: string;
  @IsString() @IsOptional() tipoDocCodigo?: string;
  @IsString() @IsNotEmpty() cliente: string;
  @IsString() @IsOptional() ruc?: string;
  @IsString() @IsOptional() direccion?: string;
  @IsDateString() fecha: string;
  @IsString() @IsOptional() viaje?: string;
  @IsNumber() @Min(0) @IsOptional() monto?: number;
  @IsNumber() @Min(0) @IsOptional() igv?: number;
  @IsIn(['Emitida', 'Aceptada', 'Pagada', 'Anulada']) @IsOptional() estadoSunat?: string;
  // Electrónica
  @IsArray() @ValidateNested({ each: true }) @Type(() => ItemDto) @IsOptional() items?: ItemDto[];
  @IsString() @IsOptional() moneda?: string;
  @IsNumber() @Min(0) @IsOptional() tipoCambio?: number;
  @IsNumber() @IsOptional() valorReferencial?: number;
  // Insumos del valor referencial (tablas DS 022-2025-MTC)
  @IsIn(['', 'local', 'nacional']) @IsOptional() vrAmbito?: string;
  @IsString() @IsOptional() vrRuta?: string;
  @IsString() @IsOptional() vrDestino?: string;
  @IsString() @IsOptional() vrPuerto?: string;
  @IsString() @IsOptional() vrZona?: string;
  @IsString() @IsOptional() vrTipoCarga?: string;
  @IsNumber() @Min(0) @IsOptional() pesoTM?: number;
  @IsString() @IsOptional() referenciaVR?: string;
  @IsString() @IsOptional() guia?: string;
  @IsString() @IsOptional() guiaTransportista?: string;
  @IsString() @IsOptional() ubigeoOrigen?: string;
  @IsString() @IsOptional() ubigeoDestino?: string;
  @IsString() @IsOptional() detalleViaje?: string;
  @IsIn(['Contado', 'Credito']) @IsOptional() formaPago?: string;
  @IsDateString() @IsOptional() fechaVencimiento?: string;
  // Referencia para NC/ND
  @IsString() @IsOptional() docRefTipo?: string;
  @IsString() @IsOptional() docRefSerie?: string;
  @IsString() @IsOptional() docRefCorrelativo?: string;
  @IsString() @IsOptional() codTipNc?: string;
  @IsString() @IsOptional() motivo?: string;
}
class UpdateFacturaDto extends PartialType(CreateFacturaDto) {}

class AnularDto { @IsString() @IsOptional() motivo?: string; }
class CorreoDto { @IsString() @IsNotEmpty() correo: string; }

// Campos escalares (sin items) que van directo a la tabla.
function toData(dto: Partial<CreateFacturaDto>) {
  const { fecha, fechaVencimiento, monto, igv, items, tipo, tipoDocCodigo, motivo, ...rest } = dto;
  const data: any = { ...rest };
  if (tipo !== undefined) {
    data.tipo = tipo;
    data.tipoDocCodigo = tipoDocCodigo || TIPO_COD[tipo] || '01';
  } else if (tipoDocCodigo !== undefined) {
    data.tipoDocCodigo = tipoDocCodigo;
  }
  if (fecha) data.fecha = new Date(fecha);
  if (fechaVencimiento !== undefined) data.fechaVencimiento = fechaVencimiento ? new Date(fechaVencimiento) : null;
  if (monto !== undefined) {
    data.monto = monto;
    data.igv = igv !== undefined ? igv : Math.round(monto * 0.18 * 100) / 100;
  } else if (igv !== undefined) {
    data.igv = igv;
  }
  return data;
}

function itemsCreate(items?: ItemDto[]) {
  return (items ?? []).map((it, i) => ({
    descripcion: it.descripcion, cantidad: it.cantidad ?? 1, valorUnitario: it.valorUnitario,
    afectacion: it.afectacion ?? '10', unidad: it.unidad ?? 'ZZ', orden: i,
  }));
}

@Injectable()
class FacturasService {
  constructor(private prisma: PrismaService) {}
  findAll(sedeId: string) { return this.prisma.factura.findMany({ where: { sedeId }, orderBy: { fecha: 'desc' }, include: { items: { orderBy: { orden: 'asc' } } } }); }
  async findOne(sedeId: string, id: string) {
    const f = await this.prisma.factura.findFirst({ where: { id, sedeId }, include: { items: { orderBy: { orden: 'asc' } } } });
    if (!f) throw new NotFoundException('Factura no encontrada');
    return f;
  }
  create(sedeId: string, dto: CreateFacturaDto) {
    const data = toData(dto);
    return this.prisma.factura.create({ data: { ...data, sedeId, serie: dto.serie ?? '', items: { create: itemsCreate(dto.items) } }, include: { items: true } });
  }
  async update(sedeId: string, id: string, dto: UpdateFacturaDto) {
    await this.findOne(sedeId, id);
    if (dto.items) {
      await this.prisma.facturaItem.deleteMany({ where: { facturaId: id } });
      await this.prisma.facturaItem.createMany({ data: itemsCreate(dto.items).map((it) => ({ ...it, facturaId: id })) });
    }
    await this.prisma.factura.update({ where: { id }, data: toData(dto) });
    return this.findOne(sedeId, id);
  }
  async remove(sedeId: string, id: string) { await this.findOne(sedeId, id); await this.prisma.factura.delete({ where: { id } }); return { ok: true }; }
}

@Injectable()
class EmisionService {
  constructor(
    private prisma: PrismaService,
    private client: MifactClient,
    private correlativos: CorrelativosService,
    private mapper: MifactMapper,
    private mifactCfg: MifactConfigService,
    private valorRef: ValorReferencialService,
  ) {}

  // Si la factura tiene los insumos del valor referencial (ámbito + ruta/destino o
  // puerto/zona/tipo de carga), lo recalcula desde las tablas del DS 022-2025-MTC
  // (fuente autoritativa) en vez de confiar en el número guardado. Si no, deja el
  // valorReferencial manual que ya tenga.
  private valorReferencialDe(f: any): number {
    if (!f.vrAmbito) return f.valorReferencial || 0;
    try {
      const { valorReferencial } = this.valorRef.calcular({
        ambito: f.vrAmbito, pesoTM: f.pesoTM,
        ruta: f.vrRuta, destino: f.vrDestino,
        puerto: f.vrPuerto, zona: f.vrZona, tipoCarga: f.vrTipoCarga,
      });
      return valorReferencial;
    } catch {
      return f.valorReferencial || 0;
    }
  }

  private async cargar(sedeId: string, id: string) {
    const f = await this.prisma.factura.findFirst({ where: { id, sedeId }, include: { items: { orderBy: { orden: 'asc' } } } });
    if (!f) throw new NotFoundException('Factura no encontrada');
    return f;
  }
  private async emisor(sedeId: string) {
    const e = await this.prisma.emisorConfig.findUnique({ where: { sedeId } });
    if (!e) throw new BadRequestException('Configura primero los datos del emisor.');
    return e;
  }
  private serieDe(emisor: any, tipoDoc: string): string {
    if (tipoDoc === '03') return emisor.serieBoleta || 'BN01';
    if (tipoDoc === '07') return emisor.serieNotaCredito || emisor.serieFactura || 'FN01';
    return emisor.serieFactura || 'FN01';
  }
  private fechaISO(d: any): string { return new Date(d).toISOString().slice(0, 10); }

  private itemsMapper(f: any): ItemMap[] {
    if (f.items?.length) {
      return f.items.map((it: any) => ({ descripcion: it.descripcion, cantidad: it.cantidad, valorUnitario: it.valorUnitario, afectacion: it.afectacion, unidad: it.unidad }));
    }
    const ref = f.viaje && f.viaje !== '-' ? ` ${f.viaje}` : '';
    return [{ descripcion: `SERVICIO DE TRANSPORTE${ref}`.trim(), cantidad: 1, valorUnitario: f.monto || 0 }];
  }
  private mapFactura(f: any, serie: string, correlativo: string): FacturaMap {
    return {
      tipoDocCodigo: f.tipoDocCodigo || '01', serie, correlativo, fecha: this.fechaISO(f.fecha),
      moneda: f.moneda || 'PEN', tipoCambio: f.tipoCambio,
      cliente: f.cliente, ruc: f.ruc && f.ruc !== '-' ? f.ruc : '', direccion: f.direccion,
      items: this.itemsMapper(f),
      valorReferencial: f.valorReferencial, ubigeoOrigen: f.ubigeoOrigen, ubigeoDestino: f.ubigeoDestino, detalleViaje: f.detalleViaje,
      formaPago: f.formaPago, fechaVencimiento: f.fechaVencimiento ? this.fechaISO(f.fechaVencimiento) : null,
      referencia: f.referenciaVR, guia: f.guia, guiaTransportista: f.guiaTransportista,
      docRefTipo: f.docRefTipo, docRefSerie: f.docRefSerie, docRefCorrelativo: f.docRefCorrelativo, codTipNc: f.codTipNc, motivo: f.motivo,
    };
  }
  private estadoSunatDe(estadoDoc: string): string {
    if (estadoDoc === '102' || estadoDoc === '103') return 'Aceptada';
    if (estadoDoc === '105' || estadoDoc === '108') return 'Anulada';
    return 'Emitida';
  }

  // Revisa TODAS las causas comunes de rechazo de SUNAT antes de enviar, para no
  // gastar numeración ni recibir el 104. Junta todos los problemas en un solo mensaje.
  private preflight(f: any, emisor: any) {
    const e: string[] = [];
    const t = (v: any) => String(v ?? '').trim();
    const tipoDoc = f.tipoDocCodigo || '01';
    // Emisor
    if (!t(emisor.ruc)) e.push('falta el RUC del emisor');
    if (!t(emisor.razonSocial)) e.push('falta la razón social del emisor');
    if (!t(emisor.ubigeo)) e.push('falta el ubigeo del emisor');
    if (!t(emisor.direccionFiscal)) e.push('falta la dirección fiscal del emisor');
    // Cliente / receptor
    if (!t(f.cliente)) e.push('falta el cliente');
    const rucRecep = f.ruc && f.ruc !== '-' ? t(f.ruc) : '';
    if (tipoDoc === '01' && rucRecep.length !== 11) e.push('la factura requiere un RUC de cliente válido de 11 dígitos');
    // Líneas / montos
    const items = (f.items || []) as any[];
    const base = items.length ? items.reduce((s, it) => s + (it.valorUnitario || 0) * (it.cantidad || 1), 0) : f.monto || 0;
    if (base <= 0) e.push('el comprobante no tiene monto (cada línea debe tener un valor unitario mayor a 0)');
    if (items.some((it) => (it.valorUnitario || 0) <= 0)) e.push('hay líneas con valor unitario en 0 (SUNAT no acepta precios en cero)');
    if (items.some((it) => !t(it.descripcion))) e.push('hay líneas sin descripción');
    // Detracción (transporte)
    const total = Math.round(base * 1.18 * 100) / 100;
    const sujetoDetr = (tipoDoc === '01' || tipoDoc === '03') && total > (emisor.umbralDetraccion ?? 700);
    if (sujetoDetr) {
      if (!t(emisor.ctaDetraccion)) e.push('el comprobante supera el umbral de detracción pero falta la CUENTA DE DETRACCIÓN (Banco de la Nación) en Datos del emisor');
      if (!t(f.ubigeoOrigen) || !t(f.ubigeoDestino)) e.push('la detracción de transporte requiere el ubigeo de origen y de destino');
    }
    // Nota de crédito / débito
    if ((tipoDoc === '07' || tipoDoc === '08') && !(t(f.docRefSerie) && t(f.docRefCorrelativo))) {
      e.push('la nota de crédito/débito requiere el documento de referencia (serie y número)');
    }
    if (e.length) throw new BadRequestException('No se puede emitir: ' + e.join(' · ') + '.');
  }

  async emitir(sedeId: string, id: string) {
    const emisor = await this.emisor(sedeId);
    if (!emisor.activo) throw new BadRequestException('La emisión electrónica no está habilitada para esta sede.');
    if (!this.mifactCfg.integracionConfigurada) throw new BadRequestException(`Falta configurar MiFact para el ambiente "${this.mifactCfg.ambiente}".`);
    const f = await this.cargar(sedeId, id);
    // Estados terminales: no se reemite (MiFact ya lo tiene). Solo se puede (re)emitir
    // un comprobante Sin emitir ('') o Rechazado ('104', tras corregirlo).
    const ESTADO_TERMINAL: Record<string, string> = {
      '101': 'El comprobante está en proceso en SUNAT; espera su resultado (usa "Estado").',
      '102': 'El comprobante ya fue aceptado por SUNAT; no se reemite.',
      '103': 'El comprobante ya fue aceptado (con observación) por SUNAT; no se reemite.',
      '105': 'El comprobante fue anulado; no se puede volver a emitir.',
      '108': 'El comprobante tiene una solicitud de baja; no se puede volver a emitir.',
    };
    if (ESTADO_TERMINAL[f.estadoDocumento || '']) throw new BadRequestException(ESTADO_TERMINAL[f.estadoDocumento || '']);

    // Recalcula el valor referencial desde las tablas del DS (si hay insumos) y lo
    // persiste, para que la detracción se calcule sobre el mayor entre total y VR.
    const vr = this.valorReferencialDe(f);
    if (vr !== (f.valorReferencial || 0)) {
      f.valorReferencial = vr;
      await this.prisma.factura.update({ where: { id }, data: { valorReferencial: vr } });
    }

    // Validación local COMPLETA antes de reservar correlativo y enviar: evita rechazos de
    // SUNAT (y gastar numeración) por datos faltantes.
    this.preflight(f, emisor);

    const tipoDoc = f.tipoDocCodigo || '01';
    // Serie válida ya asignada (empieza por letra) o la de la config.
    const serie = f.correlativo && /^[A-Za-z]/.test(f.serie || '') ? f.serie : this.serieDe(emisor, tipoDoc);
    // Reusar correlativo de un intento previo; si no hay, reservar uno nuevo.
    const correlativo = f.correlativo || (await this.correlativos.reservar(sedeId, tipoDoc, serie));
    // Persistir la reserva ANTES de enviar: si el envío se corta, el reintento reutiliza
    // el mismo número (sin saltos) en vez de reservar otro.
    if (!f.correlativo) {
      await this.prisma.factura.update({ where: { id }, data: { serie, correlativo, tipoDocCodigo: tipoDoc } });
    }

    // Cuentas bancarias activas de la sede → se envían en el comprobante para que el cliente pague.
    const cuentas = await this.prisma.cuentaBancaria.findMany({ where: { sedeId, activo: true }, orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }] });
    const { payload, calc } = this.mapper.sendInvoice(this.mapFactura(f, serie, correlativo), { ...(emisor as any), cuentas });
    const resp = await this.client.sendInvoice(payload);
    const estadoDoc = String(resp.estado_documento || '');

    await this.prisma.factura.update({
      where: { id },
      data: {
        serie, correlativo, tipoDocCodigo: tipoDoc,
        gravado: calc.gravado, igv: calc.igv, total: calc.total, monto: calc.gravado,
        sujetoDetraccion: calc.sujetoDetraccion, montoDetraccion: calc.montoDetraccion,
        porcDetraccion: calc.sujetoDetraccion ? (emisor.porcDetraccion ?? 4) : 0,
        codDetraccion: calc.sujetoDetraccion ? (emisor.codDetraccion || '027') : '',
        ctaDetraccion: calc.sujetoDetraccion ? (emisor.ctaDetraccion || '') : '',
        estadoDocumento: estadoDoc, sunatDescripcion: resp.sunat_description || resp.errors || '',
        sunatResponsecode: String(resp.sunat_responsecode || ''), hash: resp.codigo_hash || '',
        qr: resp.cadena_para_codigo_qr || '', ticket: resp.ticket_sunat || '',
        xml: resp.xml_enviado || null, cdr: resp.cdr_sunat || null,
        emitidoEn: new Date(), estadoSunat: this.estadoSunatDe(estadoDoc),
      },
    });
    const factura = await this.cargar(sedeId, id);
    return { factura, respuesta: { estado_documento: estadoDoc, errors: resp.errors || '', sunat_description: resp.sunat_description || '' } };
  }

  async estado(sedeId: string, id: string) {
    const emisor = await this.emisor(sedeId);
    const f = await this.cargar(sedeId, id);
    if (!f.correlativo) throw new BadRequestException('El comprobante aún no fue emitido.');
    const resp = await this.client.getEstatusInvoice(this.mapper.getEstatus(this.mapFactura(f, f.serie, f.correlativo), emisor as any));
    const estadoDoc = String(resp.estado_documento || f.estadoDocumento || '');
    await this.prisma.factura.update({ where: { id }, data: { estadoDocumento: estadoDoc, sunatDescripcion: resp.sunat_description || f.sunatDescripcion, estadoSunat: this.estadoSunatDe(estadoDoc) } });
    return this.cargar(sedeId, id);
  }

  async pdf(sedeId: string, id: string) {
    const emisor = await this.emisor(sedeId);
    const f = await this.cargar(sedeId, id);
    if (!f.correlativo) throw new BadRequestException('El comprobante aún no fue emitido.');
    const resp = await this.client.getInvoice(this.mapper.getInvoice(this.mapFactura(f, f.serie, f.correlativo), emisor as any, { pdf: true }));
    if (!resp.pdf_bytes) throw new BadRequestException('MiFact no devolvió el PDF del comprobante.');
    return { nombre: `${f.serie}-${f.correlativo}.pdf`, mime: 'application/pdf', base64: resp.pdf_bytes };
  }

  async anular(sedeId: string, id: string, motivo: string) {
    const emisor = await this.emisor(sedeId);
    const f = await this.cargar(sedeId, id);
    if (!f.correlativo) throw new BadRequestException('El comprobante aún no fue emitido.');
    const resp = await this.client.lowInvoice(this.mapper.lowInvoice(this.mapFactura(f, f.serie, f.correlativo), emisor as any, motivo || 'ANULACION'));
    const estadoDoc = String(resp.estado_documento || '105');
    await this.prisma.factura.update({ where: { id }, data: { estadoDocumento: estadoDoc, estadoSunat: 'Anulada', sunatDescripcion: resp.sunat_description || 'Anulación solicitada', ticket: resp.ticket_sunat || f.ticket } });
    return this.cargar(sedeId, id);
  }

  async correo(sedeId: string, id: string, correo: string) {
    const emisor = await this.emisor(sedeId);
    const f = await this.cargar(sedeId, id);
    if (!f.correlativo) throw new BadRequestException('El comprobante aún no fue emitido.');
    const resp = await this.client.sendMailInvoice(this.mapper.sendMail(this.mapFactura(f, f.serie, f.correlativo), emisor as any, correo));
    return { ok: !resp.errors, mensaje: resp.errors || 'Correo enviado' };
  }
}

@Controller('facturas')
class FacturasController {
  constructor(private readonly service: FacturasService, private readonly emision: EmisionService) {}
  @Get() findAll(@CurrentUser() u: JwtUser) { return this.service.findAll(u.sedeId); }
  @Get(':id') findOne(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.findOne(u.sedeId, id); }
  @Post() create(@CurrentUser() u: JwtUser, @Body() dto: CreateFacturaDto) { return this.service.create(u.sedeId, dto); }
  @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateFacturaDto) { return this.service.update(u.sedeId, id, dto); }
  @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.remove(u.sedeId, id); }
  // --- Facturación electrónica ---
  @Post(':id/emitir') emitir(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.emision.emitir(u.sedeId, id); }
  @Post(':id/estado') estado(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.emision.estado(u.sedeId, id); }
  @Get(':id/pdf') pdf(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.emision.pdf(u.sedeId, id); }
  @Post(':id/anular') anular(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: AnularDto) { return this.emision.anular(u.sedeId, id, dto.motivo || ''); }
  @Post(':id/correo') correo(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: CorreoDto) { return this.emision.correo(u.sedeId, id, dto.correo); }
}

@Module({ imports: [FacturacionElectronicaModule], controllers: [FacturasController], providers: [FacturasService, EmisionService] })
export class FacturasModule {}
