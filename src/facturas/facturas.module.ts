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
  @IsNumber() @IsOptional() valorReferencial?: number;
  @IsString() @IsOptional() referenciaVR?: string;
  @IsString() @IsOptional() ubigeoOrigen?: string;
  @IsString() @IsOptional() ubigeoDestino?: string;
  @IsString() @IsOptional() detalleViaje?: string;
  @IsIn(['Contado', 'Credito']) @IsOptional() formaPago?: string;
  @IsDateString() @IsOptional() fechaVencimiento?: string;
  // Referencia para NC/ND
  @IsString() @IsOptional() docRefTipo?: string;
  @IsString() @IsOptional() docRefSerie?: string;
  @IsString() @IsOptional() docRefCorrelativo?: string;
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
  ) {}

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
      docRefTipo: f.docRefTipo, docRefSerie: f.docRefSerie, docRefCorrelativo: f.docRefCorrelativo, motivo: f.motivo,
    };
  }
  private estadoSunatDe(estadoDoc: string): string {
    if (estadoDoc === '102' || estadoDoc === '103') return 'Aceptada';
    if (estadoDoc === '105' || estadoDoc === '108') return 'Anulada';
    return 'Emitida';
  }

  async emitir(sedeId: string, id: string) {
    const emisor = await this.emisor(sedeId);
    if (!emisor.activo) throw new BadRequestException('La emisión electrónica no está habilitada para esta sede.');
    if (!this.mifactCfg.integracionConfigurada) throw new BadRequestException(`Falta configurar MiFact para el ambiente "${this.mifactCfg.ambiente}".`);
    const f = await this.cargar(sedeId, id);
    if (f.estadoDocumento === '102') throw new BadRequestException('El comprobante ya fue aceptado por SUNAT; no se reemite.');

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

    const { payload, calc } = this.mapper.sendInvoice(this.mapFactura(f, serie, correlativo), emisor as any);
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
