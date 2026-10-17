import { Module, Injectable, NotFoundException, BadRequestException, ConflictException, ServiceUnavailableException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsNotEmpty, Min, ValidateNested } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { inflateRawSync } from 'zlib';
import { Roles, CurrentUser, JwtUser } from '../common/decorators';
import { FacturacionElectronicaModule } from '../facturacion-electronica/facturacion-electronica.module';
import { MifactClient } from '../facturacion-electronica/mifact.client';
import { MifactConfigService } from '../facturacion-electronica/mifact-config.service';
import { CorrelativosService } from '../facturacion-electronica/correlativos.service';
import { MifactMapper, leerGuias, type FacturaMap, type ItemMap } from '../facturacion-electronica/mifact.mapper';
import { ValorReferencialService } from '../facturacion-electronica/valor-referencial.service';

const TIPO_COD: Record<string, string> = { Factura: '01', Boleta: '03', 'N. Crédito': '07', 'N. Débito': '08' };

class ItemDto {
  @IsString() @IsNotEmpty() descripcion: string;
  @IsNumber() @Min(0) @IsOptional() cantidad?: number;
  @IsNumber() @Min(0) valorUnitario: number;
  @IsString() @IsOptional() afectacion?: string;
  @IsString() @IsOptional() unidad?: string;
}

// Un servicio (viaje) del comprobante con su propio valor referencial.
class ServicioVRDto {
  @IsString() @IsOptional() detalle?: string;
  @IsNumber() @Min(0) valor: number;
  @IsIn(['', 'local', 'nacional']) @IsOptional() ambito?: string;
  @IsString() @IsOptional() ruta?: string;
  @IsString() @IsOptional() destino?: string;
  @IsString() @IsOptional() puerto?: string;
  @IsString() @IsOptional() zona?: string;
  @IsString() @IsOptional() tipoCarga?: string;
  @IsNumber() @Min(0) @IsOptional() pesoTM?: number;
}

class CreateFacturaDto {
  @IsString() @IsOptional() serie?: string;
  @IsIn(['Factura', 'Boleta', 'N. Crédito', 'N. Débito']) tipo: string;
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
  // Desglose del valor referencial por servicio (un viaje = una fila). Si viene,
  // manda sobre los insumos sueltos de abajo: el total es la suma de los servicios.
  @IsArray() @ValidateNested({ each: true }) @Type(() => ServicioVRDto) @IsOptional() serviciosVR?: ServicioVRDto[];
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
  @IsString() @IsOptional() origen?: string;
  @IsString() @IsOptional() destino?: string;
  @IsString() @IsOptional() detalleViaje?: string;
  @IsString() @IsOptional() observaciones?: string;
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
// Cobranza: marcar pagada / pendiente y adjuntar comprobantes de pago.
class PagoDto {
  @IsBoolean() pagada: boolean;
  @IsDateString() @IsOptional() fechaPago?: string;
  @IsString() @IsOptional() notaPago?: string;
  @IsNumber() @Min(0) @IsOptional() montoCobrado?: number; // en la moneda del comprobante; por defecto, el neto
  @IsIn(['Cliente', 'Empresa']) @IsOptional() detraccionResponsable?: string; // si no viene, se deduce del monto cobrado
}
// Pago recibido (completo o a cuenta). cerrar = con este pago la factura queda cancelada.
class AbonoDto {
  @IsDateString() fecha: string;
  @IsNumber() @Min(0.01) monto: number; // en la moneda del comprobante
  @IsString() @IsOptional() nota?: string;
  @IsBoolean() @IsOptional() cerrar?: boolean;
  @IsIn(['Cliente', 'Empresa']) @IsOptional() detraccionResponsable?: string; // si no viene, se deduce de lo cobrado
}
// Depósito de la detracción en el Banco de la Nación. numero vacío = quitar el depósito.
class DetraccionDto {
  @IsIn(['Cliente', 'Empresa']) @IsOptional() responsable?: string;
  @IsDateString() @IsOptional() fecha?: string | null;
  @IsString() @IsOptional() numero?: string;
  @IsNumber() @Min(0) @IsOptional() monto?: number; // soles
}

const r2 = (n: number) => Math.round(n * 100) / 100;

// Quién deposita la detracción según lo que se cobró: si el cliente pagó el neto, la
// descontó y le toca depositarla a él (lo normal); si pagó el total, la empresa recibió
// ese dinero y le toca depositarla a ella. Se decide por el más cercano de los dos.
// (El frontend usa la misma regla para sugerirlo mientras se escribe el monto.)
function responsableDetraccion(montoCobrado: number, neto: number, detraccion: number): 'Cliente' | 'Empresa' {
  return montoCobrado >= neto + detraccion / 2 ? 'Empresa' : 'Cliente';
}
// Archivos adjuntos de la factura: constancias de pago o documentos que pide el cliente para
// pagar (guías firmadas, conformidad del servicio…). Los documentos aceptan también Word y Excel.
const MIME_PAGO = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MIME_DOCUMENTO = [
  ...MIME_PAGO,
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
class ComprobantePagoDto {
  @IsString() @IsNotEmpty() base64: string;
  @IsString() @IsOptional() nombre?: string;
  @IsIn(MIME_DOCUMENTO, { message: 'Formato no permitido: usa JPG, PNG, PDF, Word o Excel.' }) mime: string;
  @IsIn(['pago', 'documento']) @IsOptional() tipo?: string;
}

// Campos escalares (sin items) que van directo a la tabla.
function toData(dto: Partial<CreateFacturaDto>) {
  const { fecha, fechaVencimiento, monto, igv, items, serviciosVR, tipo, tipoDocCodigo, motivo, ...rest } = dto;
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

function serviciosVRCreate(servicios?: ServicioVRDto[]) {
  return (servicios ?? []).map((s, i) => ({
    detalle: s.detalle ?? '', valor: s.valor, ambito: s.ambito ?? '',
    ruta: s.ruta ?? '', destino: s.destino ?? '', puerto: s.puerto ?? '', zona: s.zona ?? '',
    tipoCarga: s.tipoCarga ?? '', pesoTM: s.pesoTM ?? 0, orden: i,
  }));
}

// Lo que se incluye al leer una factura: sus líneas y el desglose del valor referencial.
// Numeración descendente (el correlativo va con ceros a la izquierda, así que el orden
// de texto coincide con el numérico). Los borradores (correlativo vacío) se suben al inicio.
const ORDEN_COMPROBANTES: Prisma.FacturaOrderByWithRelationInput[] = [
  { correlativo: 'desc' },
  { serie: 'asc' },
  { createdAt: 'desc' },
];

const FACTURA_INCLUDE = {
  items: { orderBy: { orden: 'asc' as const } },
  serviciosVR: { orderBy: { orden: 'asc' as const } },
  // Solo metadatos de los comprobantes de pago (el archivo se descarga aparte).
  comprobantesPago: { select: { id: true, nombre: true, mime: true, tipo: true, createdAt: true }, orderBy: { createdAt: 'asc' as const } },
  abonos: { orderBy: [{ fecha: 'asc' as const }, { createdAt: 'asc' as const }] },
};

// MiFact devuelve el XML como texto, en base64, o en base64 de un ZIP que lo contiene
// (GetInvoice). Se entrega siempre el XML plano.
function xmlPlano(xml: string): Buffer {
  if (/^\s*</.test(xml)) return Buffer.from(xml, 'utf8');
  const bin = Buffer.from(xml, 'base64');
  if (bin.readUInt32LE(0) !== 0x04034b50) return bin; // no es ZIP: ya es el XML
  // ZIP con un solo archivo: se lee el primer registro. Si los tamaños van al final (bit 3),
  // se toman del directorio central.
  const metodo = bin.readUInt16LE(8);
  let tam = bin.readUInt32LE(18);
  const inicio = 30 + bin.readUInt16LE(26) + bin.readUInt16LE(28);
  if (bin.readUInt16LE(6) & 0x08 || !tam) {
    const cd = bin.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    if (cd >= 0) tam = bin.readUInt32LE(cd + 20);
  }
  const datos = bin.subarray(inicio, inicio + tam);
  return metodo === 8 ? inflateRawSync(datos) : Buffer.from(datos);
}

// Comprobantes que se están enviando a MiFact en este momento (el backend corre en una instancia).
const EMITIENDO = new Set<string>();

@Injectable()
class FacturasService {
  constructor(private prisma: PrismaService) {}
  async findAll(sedeId: string) {
    const fs = await this.prisma.factura.findMany({ where: { sedeId }, orderBy: ORDEN_COMPROBANTES, include: FACTURA_INCLUDE });
    return [...fs.filter((f) => !f.correlativo), ...fs.filter((f) => f.correlativo)];
  }
  async findOne(sedeId: string, id: string) {
    const f = await this.prisma.factura.findFirst({ where: { id, sedeId }, include: FACTURA_INCLUDE });
    if (!f) throw new NotFoundException('Factura no encontrada');
    return f;
  }
  create(sedeId: string, dto: CreateFacturaDto) {
    const data = toData(dto);
    return this.prisma.factura.create({
      data: {
        ...data, sedeId, serie: dto.serie ?? '',
        items: { create: itemsCreate(dto.items) },
        serviciosVR: { create: serviciosVRCreate(dto.serviciosVR) },
      },
      include: FACTURA_INCLUDE,
    });
  }
  async update(sedeId: string, id: string, dto: UpdateFacturaDto) {
    await this.findOne(sedeId, id);
    if (dto.items) {
      await this.prisma.facturaItem.deleteMany({ where: { facturaId: id } });
      await this.prisma.facturaItem.createMany({ data: itemsCreate(dto.items).map((it) => ({ ...it, facturaId: id })) });
    }
    // El desglose se reemplaza completo cuando viene en el cuerpo (incluso vacío:
    // así se puede volver a un valor referencial único desde la pantalla de edición).
    if (dto.serviciosVR) {
      await this.prisma.facturaServicioVR.deleteMany({ where: { facturaId: id } });
      await this.prisma.facturaServicioVR.createMany({ data: serviciosVRCreate(dto.serviciosVR).map((s) => ({ ...s, facturaId: id })) });
    }
    await this.prisma.factura.update({ where: { id }, data: toData(dto) });
    return this.findOne(sedeId, id);
  }
  // Solo se borra un borrador que nunca se envió a MiFact. Uno enviado ya existe en SUNAT: se
  // anula con comunicación de baja o nota de crédito, nunca se borra del sistema.
  async remove(sedeId: string, id: string) {
    const f = await this.findOne(sedeId, id);
    if (f.correlativo || f.estadoDocumento) {
      throw new BadRequestException(`${f.serie}-${f.correlativo || ''} ya se envió a SUNAT: no se puede eliminar. Anúlalo (baja o nota de crédito).`);
    }
    await this.prisma.factura.delete({ where: { id } });
    return { ok: true };
  }

  // --- Cobranzas ---
  async registrarPago(sedeId: string, id: string, dto: PagoDto) {
    const f = await this.findOne(sedeId, id);
    const data: any = {};
    if (dto.pagada) {
      // Registra lo cobrado como un abono que cancela la factura (por defecto, lo que falta del neto).
      const { neto } = this.cuentas(f);
      const cobradoPrevio = r2(f.abonos.reduce((s: number, a: any) => s + a.monto, 0));
      const monto = dto.montoCobrado !== undefined ? r2(dto.montoCobrado - cobradoPrevio) : r2(neto - cobradoPrevio);
      return this.agregarAbono(sedeId, id, {
        fecha: dto.fechaPago || new Date().toISOString().slice(0, 10), monto: Math.max(monto, 0.01), nota: dto.notaPago, cerrar: true,
        detraccionResponsable: dto.detraccionResponsable,
      });
    }
    // Volver a pendiente: se conservan los abonos (lo cobrado a cuenta sigue contando).
    Object.assign(data, { pagada: false });
    // Si el depósito de la detracción ya está registrado, se conserva quién lo hizo.
    if (!f.detraccionNumero) data.detraccionResponsable = '';
    await this.prisma.factura.update({ where: { id }, data });
    return this.findOne(sedeId, id);
  }

  private cuentas(f: any) {
    const total = f.total || f.monto + f.igv;
    const detraccion = f.sujetoDetraccion ? f.montoDetraccion || 0 : 0;
    return { total, detraccion, neto: r2(total - detraccion) };
  }

  // Lo cobrado = suma de los abonos; la fecha y nota de pago son las del último.
  private async recalcularCobro(id: string, extra: Record<string, any> = {}) {
    const abonos = await this.prisma.facturaAbono.findMany({ where: { facturaId: id }, orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }] });
    const ultimo = abonos[abonos.length - 1];
    await this.prisma.factura.update({
      where: { id },
      data: {
        montoCobrado: r2(abonos.reduce((s, a) => s + a.monto, 0)),
        fechaPago: ultimo ? ultimo.fecha : null,
        notaPago: ultimo ? ultimo.nota : '',
        ...extra,
      },
    });
  }

  // Pago completo o a cuenta. Con "cerrar" la factura queda pagada; si no, sigue por cobrar con su saldo.
  async agregarAbono(sedeId: string, id: string, dto: AbonoDto) {
    const f = await this.findOne(sedeId, id);
    if (!f.correlativo || !['102', '103'].includes(f.estadoDocumento)) throw new BadRequestException('Solo se registran pagos de comprobantes aceptados por SUNAT.');
    if (f.pagada) throw new BadRequestException('La factura ya está pagada. Márcala como pendiente para registrar otro pago.');
    await this.prisma.facturaAbono.create({ data: { facturaId: id, fecha: new Date(dto.fecha), monto: r2(dto.monto), nota: dto.nota?.trim() ?? '' } });
    const extra: Record<string, any> = {};
    if (dto.cerrar) {
      extra.pagada = true;
      if (f.sujetoDetraccion) {
        const { neto, detraccion } = this.cuentas(f);
        const cobrado = r2(f.abonos.reduce((s: number, a: any) => s + a.monto, 0) + dto.monto);
        extra.detraccionResponsable = dto.detraccionResponsable || responsableDetraccion(cobrado, neto, detraccion);
      }
    }
    await this.recalcularCobro(id, extra);
    return this.findOne(sedeId, id);
  }

  // Quitar un abono reabre la factura (vuelve a por cobrar con el saldo que corresponda).
  async quitarAbono(sedeId: string, id: string, abonoId: string) {
    const f = await this.findOne(sedeId, id);
    const a = await this.prisma.facturaAbono.findFirst({ where: { id: abonoId, facturaId: id } });
    if (!a) throw new NotFoundException('Pago no encontrado');
    await this.prisma.facturaAbono.delete({ where: { id: abonoId } });
    await this.recalcularCobro(id, { pagada: false, ...(f.detraccionNumero ? {} : { detraccionResponsable: '' }) });
    return this.findOne(sedeId, id);
  }

  // Registra (o quita) el depósito de la detracción y/o a quién le corresponde hacerlo.
  async registrarDetraccion(sedeId: string, id: string, dto: DetraccionDto) {
    const f = await this.findOne(sedeId, id);
    if (!f.sujetoDetraccion) throw new BadRequestException('Este comprobante no está sujeto a detracción.');
    const data: any = {};
    if (dto.responsable !== undefined) data.detraccionResponsable = dto.responsable;
    if (dto.numero !== undefined) {
      const numero = dto.numero.trim();
      if (numero) {
        if (!dto.fecha) throw new BadRequestException('Indica la fecha del depósito de la detracción.');
        if (!(Number(dto.monto) > 0)) throw new BadRequestException('Indica el monto depositado (mayor a 0).');
        Object.assign(data, { detraccionNumero: numero, detraccionFecha: new Date(dto.fecha), detraccionMonto: r2(Number(dto.monto)) });
      } else {
        Object.assign(data, { detraccionNumero: '', detraccionFecha: null, detraccionMonto: 0 });
      }
    }
    if (!Object.keys(data).length) throw new BadRequestException('No hay nada que actualizar.');
    await this.prisma.factura.update({ where: { id }, data });
    return this.findOne(sedeId, id);
  }
  async agregarComprobantePago(sedeId: string, id: string, dto: ComprobantePagoDto) {
    await this.findOne(sedeId, id);
    const archivo = Buffer.from(dto.base64, 'base64');
    if (!archivo.length) throw new BadRequestException('El archivo está vacío.');
    if (archivo.length > 10 * 1024 * 1024) throw new BadRequestException('El archivo supera 10 MB.');
    const tipo = dto.tipo === 'documento' ? 'documento' : 'pago';
    if (tipo === 'pago' && !MIME_PAGO.includes(dto.mime)) throw new BadRequestException('El comprobante de pago debe ser JPG, PNG o PDF.');
    await this.prisma.facturaComprobantePago.create({ data: { facturaId: id, archivo, nombre: dto.nombre || (tipo === 'documento' ? 'documento' : 'comprobante'), mime: dto.mime, tipo } });
    return this.findOne(sedeId, id);
  }
  async descargarComprobantePago(sedeId: string, id: string, cid: string) {
    await this.findOne(sedeId, id);
    const c = await this.prisma.facturaComprobantePago.findFirst({ where: { id: cid, facturaId: id } });
    if (!c) throw new NotFoundException('Comprobante no encontrado');
    return { nombre: c.nombre, mime: c.mime, base64: Buffer.from(c.archivo).toString('base64') };
  }
  async quitarComprobantePago(sedeId: string, id: string, cid: string) {
    await this.findOne(sedeId, id);
    await this.prisma.facturaComprobantePago.deleteMany({ where: { id: cid, facturaId: id } });
    return this.findOne(sedeId, id);
  }
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

  // Valor referencial de UN servicio: si tiene ámbito, se recalcula desde las tablas
  // del DS 022-2025-MTC (fuente autoritativa); si no, vale el número ingresado a mano.
  // Si el recálculo falla (ruta/zona que ya no existe en la tabla) se respeta el valor
  // guardado en vez de dejar el comprobante en cero.
  private vrDeServicio(s: { ambito?: string; ruta?: string; destino?: string; puerto?: string; zona?: string; tipoCarga?: string; pesoTM?: number; valor: number }): number {
    if (!s.ambito) return s.valor || 0;
    try {
      const { valorReferencial } = this.valorRef.calcular({
        ambito: s.ambito as 'local' | 'nacional', pesoTM: s.pesoTM,
        ruta: s.ruta, destino: s.destino,
        puerto: s.puerto, zona: s.zona, tipoCarga: s.tipoCarga as any,
      });
      return valorReferencial;
    } catch {
      return s.valor || 0;
    }
  }

  // Valor referencial del comprobante. Si tiene desglose por servicio (una factura
  // puede juntar varios viajes), es la SUMA del valor referencial de cada uno. Si no,
  // se recalcula el valor único desde los insumos sueltos, y a falta de insumos se
  // deja el valorReferencial manual que ya tenga.
  private valorReferencialDe(f: any): number {
    const servicios = (f.serviciosVR ?? []) as any[];
    if (servicios.length) {
      return Math.round(servicios.reduce((s, x) => s + this.vrDeServicio(x), 0) * 100) / 100;
    }
    if (!f.vrAmbito) return f.valorReferencial || 0;
    return this.vrDeServicio({
      ambito: f.vrAmbito, pesoTM: f.pesoTM,
      ruta: f.vrRuta, destino: f.vrDestino,
      puerto: f.vrPuerto, zona: f.vrZona, tipoCarga: f.vrTipoCarga,
      valor: f.valorReferencial || 0,
    });
  }

  private async cargar(sedeId: string, id: string) {
    const f = await this.prisma.factura.findFirst({ where: { id, sedeId }, include: FACTURA_INCLUDE });
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
    if (tipoDoc === '08') return emisor.serieNotaDebito || emisor.serieFactura || 'FD01';
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
      valorReferencial: f.valorReferencial, ubigeoOrigen: f.ubigeoOrigen, ubigeoDestino: f.ubigeoDestino, origen: f.origen, destino: f.destino, detalleViaje: f.detalleViaje, observaciones: f.observaciones,
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
    const sujetoDetr = (tipoDoc === '01' || tipoDoc === '03') && total > (emisor.umbralDetraccion ?? 400);
    if (sujetoDetr) {
      if (!t(emisor.ctaDetraccion)) e.push('el comprobante supera el umbral de detracción pero falta la CUENTA DE DETRACCIÓN (Banco de la Nación) en Datos del emisor');
      if (!t(f.ubigeoOrigen) || !t(f.ubigeoDestino)) e.push('la detracción de transporte requiere el ubigeo de origen y de destino');
      // Sin valor referencial el transporte va con VALOR_REF en 0: SUNAT lo rechaza y MiFact
      // (demo) muestra un valor por defecto. Se exige calcularlo/sumarlo por servicio.
      if (!(Number(f.valorReferencial) > 0)) e.push('la detracción de transporte requiere el VALOR REFERENCIAL (calcúlalo con las tablas del MTC y suma el de cada viaje)');
    }
    // Guías de remisión: cada una debe ser SERIE-NÚMERO (pueden ser varias, separadas por coma).
    // Una mal escrita se mandaría deformada a SUNAT, así que se frena aquí con el valor exacto.
    for (const [campo, valor] of [['guía remitente', f.guia], ['guía transportista', f.guiaTransportista]] as const) {
      const { invalidas } = leerGuias(valor);
      if (invalidas.length) {
        e.push(`en ${campo} no se reconoce ${invalidas.map((x) => `"${x}"`).join(', ')} (cada guía va como SERIE-NÚMERO, p. ej. EG07-4314, y varias se separan con coma)`);
      }
    }
    // Nota de crédito / débito
    if ((tipoDoc === '07' || tipoDoc === '08') && !(t(f.docRefSerie) && t(f.docRefCorrelativo))) {
      e.push('la nota de crédito/débito requiere el documento de referencia (serie y número)');
    }
    if (e.length) throw new BadRequestException('No se puede emitir: ' + e.join(' · ') + '.');
  }

  // Un comprobante no puede enviarse dos veces a la vez (doble clic, dos pestañas): el segundo
  // pedido se rechaza mientras el primero espera la respuesta de MiFact.
  async emitir(sedeId: string, id: string) {
    if (EMITIENDO.has(id)) throw new ConflictException('Este comprobante ya se está enviando a SUNAT; espera el resultado.');
    EMITIENDO.add(id);
    try {
      return await this.emitirUnaVez(sedeId, id);
    } finally {
      EMITIENDO.delete(id);
    }
  }

  private async emitirUnaVez(sedeId: string, id: string) {
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
    // Cuentas bancarias activas de la sede → se envían en el comprobante para que el cliente pague.
    const cuentas = await this.prisma.cuentaBancaria.findMany({ where: { sedeId, activo: true }, orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }] });
    const emisorConCuentas = { ...(emisor as any), cuentas };

    // NUMERACIÓN — regla para no duplicar comprobantes en SUNAT:
    // · Si el comprobante ya tiene número de un intento anterior, se reenvía con ESE número. Si
    //   MiFact dice que ya existe, es ese mismo envío anterior (llegó pero no se registró aquí):
    //   se consulta su estado y se sincroniza. Nunca se reenvía con otro número.
    // · Solo se usa un número nuevo si no tenía, o si el anterior fue RECHAZADO (104: SUNAT no lo
    //   cuenta). Si un número recién reservado ya existe en MiFact (numeración atrasada respecto
    //   de MiFact), se pasa al siguiente: este comprobante aún no se había enviado con ninguno.
    const numeroPrevio = f.correlativo && f.estadoDocumento !== '104' ? f.correlativo : '';
    let correlativo = numeroPrevio || (await this.correlativos.reservar(sedeId, tipoDoc, serie));
    // Persistir el número ANTES de enviar: si la respuesta se pierde, el reintento usa el mismo.
    if (correlativo !== f.correlativo || serie !== f.serie) {
      await this.prisma.factura.update({ where: { id }, data: { serie, correlativo, tipoDocCodigo: tipoDoc } });
    }
    const esDuplicado = (r: any) => /ya existe|already exists|existe en la bd/i.test(String(r?.errors || r?.sunat_description || ''));
    let calc: any;
    let resp: any;
    const MAX_INTENTOS = 10;
    for (let i = 0; i < MAX_INTENTOS; i++) {
      let payload: any;
      ({ payload, calc } = this.mapper.sendInvoice(this.mapFactura(f, serie, correlativo), emisorConCuentas));
      try {
        resp = await this.client.sendInvoice(payload);
      } catch (err: any) {
        // Timeout o error de red: no se sabe si MiFact lo recibió. Se consulta antes de responder
        // y el número queda guardado en el comprobante para que un reintento no lo duplique.
        const sync = await this.sincronizar(sedeId, id, f, serie, correlativo, tipoDoc, calc, emisor).catch(() => null);
        if (sync) return sync;
        throw new ServiceUnavailableException(
          `${err?.message || 'No se pudo contactar a MiFact.'} No se pudo confirmar si ${serie}-${correlativo} llegó a MiFact: ` +
          'espera unos minutos y usa "Estado" antes de volver a emitir (se reenviará con el mismo número, sin duplicar).',
        );
      }
      if (!esDuplicado(resp)) break;
      if (correlativo === numeroPrevio) {
        const sync = await this.sincronizar(sedeId, id, f, serie, correlativo, tipoDoc, calc, emisor);
        if (sync) return sync;
        throw new BadRequestException(`MiFact indica que ${serie}-${correlativo} ya existe, pero no devolvió su estado. Revísalo en el portal de MiFact antes de volver a emitir.`);
      }
      correlativo = await this.correlativos.reservar(sedeId, tipoDoc, serie);
      await this.prisma.factura.update({ where: { id }, data: { serie, correlativo, tipoDocCodigo: tipoDoc } });
    }
    return this.guardarRespuesta(sedeId, id, serie, correlativo, tipoDoc, calc, emisor, resp);
  }

  // Guarda en el comprobante el resultado de MiFact (envío o consulta de estado).
  private async guardarRespuesta(sedeId: string, id: string, serie: string, correlativo: string, tipoDoc: string, calc: any, emisor: any, resp: any, nota = '') {
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
        estadoDocumento: estadoDoc, sunatDescripcion: nota || resp.sunat_description || resp.errors || '',
        sunatResponsecode: String(resp.sunat_responsecode || ''), hash: resp.codigo_hash || '',
        qr: resp.cadena_para_codigo_qr || '', ticket: resp.ticket_sunat || '',
        xml: resp.xml_enviado || null, cdr: resp.cdr_sunat || null,
        emitidoEn: new Date(), estadoSunat: this.estadoSunatDe(estadoDoc),
      },
    });
    const factura = await this.cargar(sedeId, id);
    return { factura, respuesta: { estado_documento: estadoDoc, errors: estadoDoc ? '' : resp.errors || '', sunat_description: nota || resp.sunat_description || '' } };
  }

  // Si MiFact ya tiene el comprobante con ese número, toma su estado (sin reenviar). null si no lo tiene.
  private async sincronizar(sedeId: string, id: string, f: any, serie: string, correlativo: string, tipoDoc: string, calc: any, emisor: any) {
    const resp = await this.client.getEstatusInvoice(this.mapper.getEstatus(this.mapFactura(f, serie, correlativo), emisor as any));
    if (!resp?.estado_documento) return null;
    const nota = `Ya estaba registrado en MiFact (${serie}-${correlativo}); se sincronizó su estado sin reenviarlo.` + (resp.sunat_description ? ` ${resp.sunat_description}` : '');
    return this.guardarRespuesta(sedeId, id, serie, correlativo, tipoDoc, calc, emisor, resp, nota);
  }

  // Busca comprobantes que existen en MiFact/SUNAT pero no en el sistema: los números que faltan
  // ("huecos") dentro de cada serie. Con la lógica de reintento anterior, un envío cuya respuesta
  // se perdía se reemitía con el número siguiente, dejando el primero duplicado en SUNAT y fuera
  // del sistema. MiFact exige la fecha de emisión para consultar, así que cada hueco se prueba con
  // las fechas de sus vecinos (el duplicado lleva la misma fecha que el comprobante que duplica).
  async revisarNumeracion(sedeId: string) {
    const emisor = await this.emisor(sedeId);
    const emitidas = await this.prisma.factura.findMany({
      where: { sedeId, correlativo: { not: '' } },
      select: { id: true, tipo: true, tipoDocCodigo: true, serie: true, correlativo: true, fecha: true, cliente: true, ruc: true, total: true, moneda: true, estadoDocumento: true },
    });
    const porSerie = new Map<string, typeof emitidas>();
    for (const f of emitidas) {
      if (!/^\d+$/.test(f.correlativo)) continue;
      const k = `${f.tipoDocCodigo}|${f.serie}`;
      porSerie.set(k, [...(porSerie.get(k) || []), f]);
    }
    const MAX_CONSULTAS = 80;
    let consultas = 0;
    const hallazgos: any[] = [];
    const libres: string[] = [];
    let truncado = false;
    for (const [k, fs] of porSerie) {
      const [tipoDoc, serie] = k.split('|');
      const orden = fs.sort((a, b) => Number(a.correlativo) - Number(b.correlativo));
      for (let i = 1; i < orden.length; i++) {
        const prev = orden[i - 1];
        const next = orden[i];
        for (let n = Number(prev.correlativo) + 1; n < Number(next.correlativo); n++) {
          const correlativo = String(n).padStart(8, '0');
          const fechas = [...new Set([this.fechaISO(next.fecha), this.fechaISO(prev.fecha)])];
          let encontrado: any = null;
          let fechaHallada = '';
          for (const fecha of fechas) {
            if (consultas >= MAX_CONSULTAS) { truncado = true; break; }
            consultas++;
            const r = await this.client.getEstatusInvoice({ NUM_NIF_EMIS: emisor.ruc, COD_TIP_CPE: tipoDoc, NUM_SERIE_CPE: serie, NUM_CORRE_CPE: correlativo, FEC_EMIS: fecha }).catch(() => null);
            if (r?.estado_documento) { encontrado = r; fechaHallada = fecha; break; }
          }
          if (encontrado) {
            hallazgos.push({
              documento: `${serie}-${correlativo}`, tipoDoc, fecha: fechaHallada,
              estado: String(encontrado.estado_documento), descripcion: encontrado.sunat_description || '',
              // El duplicado suele ser del comprobante con el número siguiente (mismos datos y fecha).
              probableDuplicadoDe: { documento: `${next.serie}-${next.correlativo}`, cliente: next.cliente, ruc: next.ruc, total: next.total, moneda: next.moneda, fecha: this.fechaISO(next.fecha) },
            });
          } else if (!truncado) {
            libres.push(`${serie}-${correlativo}`);
          }
        }
      }
    }
    return { consultas, truncado, hallazgos, libres };
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

  async xml(sedeId: string, id: string) {
    const emisor = await this.emisor(sedeId);
    const f = await this.cargar(sedeId, id);
    if (!f.correlativo) throw new BadRequestException('El comprobante aún no fue emitido.');
    // Usa el XML guardado al emitir; si no está, lo pide a MiFact.
    let xml = f.xml || '';
    if (!xml) {
      // Si no se guardó al emitir (p. ej. el estado llegó por consulta), se pide a MiFact y se guarda.
      const resp = await this.client.getInvoice(this.mapper.getInvoice(this.mapFactura(f, f.serie, f.correlativo), emisor as any, { xml: true, cdr: true }));
      xml = resp.xml_enviado || '';
      if (xml) await this.prisma.factura.update({ where: { id }, data: { xml, ...(f.cdr ? {} : { cdr: resp.cdr_sunat || null }) } });
    }
    if (!xml) throw new BadRequestException('No hay XML disponible para este comprobante.');
    return { nombre: `${f.serie}-${f.correlativo}.xml`, mime: 'application/xml', base64: xmlPlano(xml).toString('base64') };
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
  // Antes de ':id' para que Nest no lo tome como un id.
  @Roles('Administrador') @Get('revisar-numeracion') revisarNumeracion(@CurrentUser() u: JwtUser) { return this.emision.revisarNumeracion(u.sedeId); }
  @Get(':id') findOne(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.findOne(u.sedeId, id); }
  @Post() create(@CurrentUser() u: JwtUser, @Body() dto: CreateFacturaDto) { return this.service.create(u.sedeId, dto); }
  @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateFacturaDto) { return this.service.update(u.sedeId, id, dto); }
  @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.remove(u.sedeId, id); }
  // --- Facturación electrónica ---
  @Post(':id/emitir') emitir(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.emision.emitir(u.sedeId, id); }
  @Post(':id/estado') estado(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.emision.estado(u.sedeId, id); }
  @Get(':id/pdf') pdf(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.emision.pdf(u.sedeId, id); }
  @Get(':id/xml') xml(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.emision.xml(u.sedeId, id); }
  @Post(':id/anular') anular(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: AnularDto) { return this.emision.anular(u.sedeId, id, dto.motivo || ''); }
  @Post(':id/correo') correo(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: CorreoDto) { return this.emision.correo(u.sedeId, id, dto.correo); }
  // --- Cobranzas ---
  @Patch(':id/pago') pago(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: PagoDto) { return this.service.registrarPago(u.sedeId, id, dto); }
  @Post(':id/abonos') abono(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: AbonoDto) { return this.service.agregarAbono(u.sedeId, id, dto); }
  @Delete(':id/abonos/:aid') quitarAbono(@CurrentUser() u: JwtUser, @Param('id') id: string, @Param('aid') aid: string) { return this.service.quitarAbono(u.sedeId, id, aid); }
  @Patch(':id/detraccion') detraccion(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: DetraccionDto) { return this.service.registrarDetraccion(u.sedeId, id, dto); }
  @Post(':id/comprobantes-pago') subirComprobante(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: ComprobantePagoDto) { return this.service.agregarComprobantePago(u.sedeId, id, dto); }
  @Get(':id/comprobantes-pago/:cid') bajarComprobante(@CurrentUser() u: JwtUser, @Param('id') id: string, @Param('cid') cid: string) { return this.service.descargarComprobantePago(u.sedeId, id, cid); }
  @Delete(':id/comprobantes-pago/:cid') quitarComprobante(@CurrentUser() u: JwtUser, @Param('id') id: string, @Param('cid') cid: string) { return this.service.quitarComprobantePago(u.sedeId, id, cid); }
}

@Module({ imports: [FacturacionElectronicaModule], controllers: [FacturasController], providers: [FacturasService, EmisionService] })
export class FacturasModule {}
