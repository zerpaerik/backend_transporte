import { Module, Injectable, NotFoundException, BadRequestException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsEmail, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min, ValidateIf, ValidateNested } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser, JwtUser } from '../common/decorators';
import { ViajesModule, ViajesService, CreateViajeDto } from '../viajes/viajes.module';

const ESTADOS = ['Borrador', 'Enviada', 'Aceptada', 'Rechazada'] as const;
// La numeración usa la tabla de correlativos con un tipo propio (no es un comprobante SUNAT).
const TIPO_COT = 'COT';

class ItemCotDto {
  @IsString() @IsNotEmpty({ message: 'Cada ítem necesita una descripción.' }) descripcion: string;
  @IsNumber() @Min(0) @IsOptional() cantidad?: number;
  @IsNumber() @Min(0) precio: number;
  @IsNumber() @Min(0) @Max(100) @IsOptional() descuento?: number;
  @IsString() @IsOptional() operacion?: string;
  @IsString() @IsOptional() origen?: string;
  @IsString() @IsOptional() destino?: string;
  @IsString() @IsOptional() devolucion?: string;
  @IsString() @IsOptional() tamanio?: string;
  @IsString() @IsOptional() tipoCarga?: string;
}

class CotizacionDto {
  @IsDateString() fecha: string;
  @IsDateString() validaHasta: string;
  @IsString() @IsNotEmpty({ message: 'El cliente es obligatorio.' }) cliente: string;
  @IsString() @IsOptional() clienteRuc?: string;
  @IsString() @IsOptional() clienteDireccion?: string;
  @IsString() @IsOptional() contactoNombre?: string;
  @ValidateIf((o) => !!o.contactoEmail) @IsEmail({}, { message: 'El correo de contacto no es válido.' }) @IsOptional() contactoEmail?: string;
  @IsString() @IsOptional() contactoTelefono?: string;
  @IsIn(['PEN', 'USD']) @IsOptional() moneda?: string;
  @IsNumber() @Min(0) @IsOptional() tipoCambio?: number;
  @IsNumber() @Min(0) @Max(100) @IsOptional() descuentoGlobal?: number;
  @IsNumber() @Min(0) @Max(100) @IsOptional() igvPorc?: number;
  @IsString() @IsOptional() notas?: string;
  @IsString() @IsOptional() condiciones?: string;
  @IsArray() @ArrayMinSize(1, { message: 'Agrega al menos un ítem.' }) @ValidateNested({ each: true }) @Type(() => ItemCotDto) items: ItemCotDto[];
}

class EstadoDto {
  @IsIn(ESTADOS as unknown as string[]) estado: string;
}

class ConvertirDto {
  @IsDateString() @IsOptional() fechaViaje?: string;
}

class SiguienteDto {
  @IsInt() @Min(1) desde: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
// Las fechas puras se guardan al mediodía de Perú para que no cambien de día por la zona horaria.
const diaPeru = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00-05:00`);
const codigoDe = (n: number) => 'COT-' + String(n).padStart(4, '0');

// Totales: subtotal = Σ cant × precio × (1 − desc%); luego descuento global %, impuesto y total.
function totales(dto: CotizacionDto) {
  const subtotal = r2(dto.items.reduce((s, i) => s + (i.cantidad ?? 1) * i.precio * (1 - (i.descuento ?? 0) / 100), 0));
  const descuento = r2(subtotal * (dto.descuentoGlobal ?? 0) / 100);
  const igv = r2((subtotal - descuento) * (dto.igvPorc ?? 18) / 100);
  return { subtotal, descuento, igv, total: r2(subtotal - descuento + igv) };
}

function itemsData(items: ItemCotDto[]) {
  return items.map((i, idx) => ({
    orden: idx, descripcion: i.descripcion.trim(), cantidad: i.cantidad ?? 1, precio: i.precio, descuento: i.descuento ?? 0,
    operacion: i.operacion ?? '', origen: i.origen ?? '', destino: i.destino ?? '', devolucion: i.devolucion ?? '',
    tamanio: i.tamanio ?? '', tipoCarga: i.tipoCarga ?? '',
  }));
}

const INCLUDE = { items: { orderBy: { orden: 'asc' as const } } };

@Injectable()
class CotizacionesService {
  constructor(private prisma: PrismaService, private viajes: ViajesService) {}

  list(sedeId: string) {
    return this.prisma.cotizacion.findMany({ where: { sedeId }, orderBy: { numero: 'desc' }, include: INCLUDE });
  }
  async findOne(sedeId: string, id: string) {
    const c = await this.prisma.cotizacion.findFirst({ where: { id, sedeId }, include: INCLUDE });
    if (!c) throw new NotFoundException('Cotización no encontrada');
    return c;
  }

  // Próximo número (el mayor entre el contador y la última registrada) y la empresa en sesión.
  async siguiente(sedeId: string) {
    const row = await this.prisma.correlativo.findUnique({ where: { sedeId_tipoDoc_serie: { sedeId, tipoDoc: TIPO_COT, serie: TIPO_COT } } });
    const ultima = await this.prisma.cotizacion.findFirst({ where: { sedeId }, orderBy: { numero: 'desc' }, select: { numero: true } });
    const n = Math.max(row?.siguiente ?? 1, (ultima?.numero ?? 0) + 1);
    return { siguiente: n, codigo: codigoDe(n), ...(await this.empresa(sedeId)) };
  }
  // Fija desde qué número sigue la numeración (p. ej. para continuar la que ya usaba la empresa).
  async fijarSiguiente(sedeId: string, desde: number) {
    const ultima = await this.prisma.cotizacion.findFirst({ where: { sedeId }, orderBy: { numero: 'desc' }, select: { numero: true } });
    if (ultima && desde <= ultima.numero) throw new BadRequestException(`Ya existe la ${codigoDe(ultima.numero)}; el siguiente número debe ser mayor.`);
    await this.prisma.correlativo.upsert({
      where: { sedeId_tipoDoc_serie: { sedeId, tipoDoc: TIPO_COT, serie: TIPO_COT } },
      create: { sedeId, tipoDoc: TIPO_COT, serie: TIPO_COT, siguiente: desde },
      update: { siguiente: desde },
    });
    return this.siguiente(sedeId);
  }

  // Datos de la empresa en sesión: los del emisor de la sede (o los de la sede si no hay emisor).
  private async empresa(sedeId: string) {
    const [emisor, sede] = await Promise.all([
      this.prisma.emisorConfig.findUnique({ where: { sedeId } }),
      this.prisma.sede.findUnique({ where: { id: sedeId } }),
    ]);
    return {
      empresaRazon: emisor?.razonSocial || sede?.nombre || '',
      empresaRuc: emisor?.ruc || sede?.ruc || '',
      empresaDireccion: emisor?.direccionFiscal || '',
    };
  }

  private validar(dto: CotizacionDto) {
    if (dto.validaHasta.slice(0, 10) < dto.fecha.slice(0, 10)) throw new BadRequestException('"Válida hasta" no puede ser anterior a la fecha.');
    if (dto.moneda === 'USD' && !(dto.tipoCambio && dto.tipoCambio > 0)) throw new BadRequestException('Indica el tipo de cambio para cotizar en dólares.');
  }

  private campos(dto: CotizacionDto) {
    return {
      fecha: diaPeru(dto.fecha), validaHasta: diaPeru(dto.validaHasta),
      cliente: dto.cliente.trim(), clienteRuc: dto.clienteRuc?.trim() ?? '', clienteDireccion: dto.clienteDireccion?.trim() ?? '',
      contactoNombre: dto.contactoNombre?.trim() ?? '', contactoEmail: dto.contactoEmail?.trim() ?? '', contactoTelefono: dto.contactoTelefono?.trim() ?? '',
      moneda: dto.moneda ?? 'PEN', tipoCambio: dto.moneda === 'USD' ? dto.tipoCambio ?? 0 : 0,
      descuentoGlobal: dto.descuentoGlobal ?? 0, igvPorc: dto.igvPorc ?? 18,
      notas: dto.notas ?? '', condiciones: dto.condiciones ?? '',
      ...totales(dto),
    };
  }

  async create(u: JwtUser, dto: CotizacionDto) {
    this.validar(dto);
    const empresa = await this.empresa(u.sedeId);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.correlativo.findUnique({ where: { sedeId_tipoDoc_serie: { sedeId: u.sedeId, tipoDoc: TIPO_COT, serie: TIPO_COT } } });
      const ultima = await tx.cotizacion.findFirst({ where: { sedeId: u.sedeId }, orderBy: { numero: 'desc' }, select: { numero: true } });
      const numero = Math.max(row?.siguiente ?? 1, (ultima?.numero ?? 0) + 1);
      await tx.correlativo.upsert({
        where: { sedeId_tipoDoc_serie: { sedeId: u.sedeId, tipoDoc: TIPO_COT, serie: TIPO_COT } },
        create: { sedeId: u.sedeId, tipoDoc: TIPO_COT, serie: TIPO_COT, siguiente: numero + 1 },
        update: { siguiente: numero + 1 },
      });
      return tx.cotizacion.create({
        data: { sedeId: u.sedeId, numero, codigo: codigoDe(numero), creadoPor: u.email, ...empresa, ...this.campos(dto), items: { create: itemsData(dto.items) } },
        include: INCLUDE,
      });
    });
  }

  async update(sedeId: string, id: string, dto: CotizacionDto) {
    const c = await this.findOne(sedeId, id);
    if (c.estado === 'Convertida') throw new BadRequestException('La cotización ya pasó a operaciones; no se puede editar.');
    this.validar(dto);
    return this.prisma.$transaction(async (tx) => {
      await tx.cotizacionItem.deleteMany({ where: { cotizacionId: id } });
      return tx.cotizacion.update({ where: { id }, data: { ...this.campos(dto), items: { create: itemsData(dto.items) } }, include: INCLUDE });
    });
  }

  async cambiarEstado(sedeId: string, id: string, estado: string) {
    const c = await this.findOne(sedeId, id);
    if (c.estado === 'Convertida') throw new BadRequestException('La cotización ya pasó a operaciones.');
    return this.prisma.cotizacion.update({ where: { id }, data: { estado }, include: INCLUDE });
  }

  async remove(sedeId: string, id: string) {
    const c = await this.findOne(sedeId, id);
    if (c.estado === 'Convertida') throw new BadRequestException('No se puede eliminar: ya tiene viajes creados en operaciones.');
    await this.prisma.cotizacion.delete({ where: { id } });
    return { ok: true };
  }

  // Crea un viaje "Programado" por cada unidad de cada ítem, con los datos del servicio y la
  // tarifa unitaria (con descuentos, en soles). Placa, conductor y contenedor quedan por asignar.
  async convertir(sedeId: string, id: string, dto: ConvertirDto) {
    const c = await this.findOne(sedeId, id);
    if (c.estado === 'Convertida') throw new BadRequestException(`Ya se crearon los viajes: ${c.viajes.join(', ')}.`);
    if (c.estado !== 'Aceptada') throw new BadRequestException('Solo se pasa a operaciones una cotización aceptada.');
    const tc = c.moneda === 'USD' ? c.tipoCambio : 1;
    const codigos: string[] = [];
    for (const it of c.items) {
      const unidades = Math.max(1, Math.round(it.cantidad));
      const tarifa = r2(it.precio * (1 - it.descuento / 100) * (1 - c.descuentoGlobal / 100) * tc);
      for (let k = 0; k < unidades; k++) {
        const viaje: CreateViajeDto = {
          placaTracto: '', cliente: c.cliente, operacion: it.operacion, tarifa,
          origen: it.origen, destino: it.destino, devolucion: it.devolucion, tamanio: it.tamanio, tipoCarga: it.tipoCarga || 'GENERAL',
          estado: 'Programado', observacion: `Cotización ${c.codigo}`,
          fechaViaje: dto.fechaViaje ? diaPeru(dto.fechaViaje).toISOString() : undefined,
        };
        const v = await this.viajes.create(sedeId, viaje);
        // Si el cliente no está en el catálogo, el viaje toma el RUC/dirección de la cotización.
        if (!v.clienteRuc && (c.clienteRuc || c.clienteDireccion)) {
          await this.prisma.viaje.update({ where: { id: v.id }, data: { clienteRuc: c.clienteRuc, clienteDireccion: c.clienteDireccion } });
        }
        codigos.push(v.codigo);
      }
    }
    return this.prisma.cotizacion.update({ where: { id }, data: { estado: 'Convertida', viajes: codigos }, include: INCLUDE });
  }
}

@Roles('Administrador', 'Operador')
@Controller('cotizaciones')
class CotizacionesController {
  constructor(private readonly service: CotizacionesService) {}
  @Get() list(@CurrentUser() u: JwtUser) { return this.service.list(u.sedeId); }
  @Get('siguiente') siguiente(@CurrentUser() u: JwtUser) { return this.service.siguiente(u.sedeId); }
  @Roles('Administrador') @Patch('siguiente') fijarSiguiente(@CurrentUser() u: JwtUser, @Body() dto: SiguienteDto) { return this.service.fijarSiguiente(u.sedeId, dto.desde); }
  @Get(':id') findOne(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.findOne(u.sedeId, id); }
  @Post() create(@CurrentUser() u: JwtUser, @Body() dto: CotizacionDto) { return this.service.create(u, dto); }
  @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: CotizacionDto) { return this.service.update(u.sedeId, id, dto); }
  @Patch(':id/estado') estado(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: EstadoDto) { return this.service.cambiarEstado(u.sedeId, id, dto.estado); }
  @Post(':id/convertir') convertir(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: ConvertirDto) { return this.service.convertir(u.sedeId, id, dto); }
  @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.remove(u.sedeId, id); }
}

@Module({ imports: [ViajesModule], controllers: [CotizacionesController], providers: [CotizacionesService] })
export class CotizacionesModule {}
