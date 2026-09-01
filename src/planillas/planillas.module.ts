import { Module, Injectable, NotFoundException, BadRequestException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser, JwtUser } from '../common/decorators';

class GenerarDto {
  @IsString() @IsNotEmpty() conductor: string;
  @IsDateString() semanaDesde: string;
  @IsDateString() semanaHasta: string;
}

class LineaDto {
  @IsString() @IsOptional() id?: string;
  @IsString() @IsOptional() planillaId?: string;
  @IsDateString() fecha: string;
  @IsString() @IsOptional() cliente?: string;
  @IsString() @IsOptional() origen?: string;
  @IsString() @IsOptional() destino?: string;
  @IsNumber() @Min(0) @IsOptional() sueldoDia?: number;
  @IsNumber() @Min(0) @IsOptional() comision?: number;
  @IsNumber() @Min(0) @IsOptional() viaticos?: number;
  @IsString() @IsOptional() concepto?: string;
  @IsString() @IsOptional() viajeId?: string;
  @IsNumber() @IsOptional() orden?: number;
}

class DescuentoDto {
  @IsString() @IsOptional() concepto?: string;
  @IsNumber() @Min(0) monto: number;
  @IsNumber() @IsOptional() orden?: number;
}

class UpdatePlanillaDto {
  @IsNumber() @Min(0) @IsOptional() sueldoDia?: number;
  // Solo se permite mover entre Borrador y Generada por aquí; aprobar y pagar tienen su propia ruta.
  @IsIn(['Borrador', 'Generada']) @IsOptional() estado?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => LineaDto) @IsOptional() lineas?: LineaDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => DescuentoDto) @IsOptional() descuentos?: DescuentoDto[];
}

class ConfigDto {
  @IsNumber() @Min(0) sueldoDia: number;
}

const dayISO = (d: Date) => new Date(d).toISOString().slice(0, 10);
const INCLUDE = { lineas: { orderBy: { orden: 'asc' as const } }, descuentos: { orderBy: { orden: 'asc' as const } } };

@Injectable()
class PlanillasService {
  constructor(private prisma: PrismaService) {}

  withTotals(p: any) {
    const lineas = p.lineas ?? [];
    const totalSueldo = lineas.reduce((s: number, l: any) => s + l.sueldoDia, 0);
    const totalComision = lineas.reduce((s: number, l: any) => s + l.comision, 0);
    const totalViaticos = lineas.reduce((s: number, l: any) => s + l.viaticos, 0);
    const totalPagar = totalSueldo + totalComision + totalViaticos;
    const totalDescuento = (p.descuentos ?? []).reduce((s: number, d: any) => s + (d.monto || 0), 0);
    const aDepositar = totalPagar - totalDescuento;
    return { ...p, totalSueldo, totalComision, totalViaticos, totalPagar, totalDescuento, aDepositar };
  }

  async config(sedeId: string) {
    const sede = await this.prisma.sede.findUnique({ where: { id: sedeId }, select: { sueldoDia: true } });
    return { sueldoDia: sede?.sueldoDia ?? 0 };
  }
  async setConfig(sedeId: string, dto: ConfigDto) {
    await this.prisma.sede.update({ where: { id: sedeId }, data: { sueldoDia: dto.sueldoDia } });
    return { sueldoDia: dto.sueldoDia };
  }

  async findAll(sedeId: string) {
    const ps = await this.prisma.planilla.findMany({ where: { sedeId }, orderBy: { createdAt: 'desc' }, include: INCLUDE });
    return ps.map((p) => this.withTotals(p));
  }
  async findOne(sedeId: string, id: string) {
    const p = await this.prisma.planilla.findFirst({ where: { id, sedeId }, include: INCLUDE });
    if (!p) throw new NotFoundException('Planilla no encontrada');
    return this.withTotals(p);
  }

  async generar(sedeId: string, dto: GenerarDto) {
    const [sede, cond] = await Promise.all([
      this.prisma.sede.findUnique({ where: { id: sedeId }, select: { sueldoDia: true } }),
      this.prisma.conductor.findFirst({ where: { sedeId, nombre: dto.conductor }, select: { descuentoMensual: true } }),
    ]);
    const sueldoDia = sede?.sueldoDia ?? 0;
    const cuotaSemanal = Math.round(((cond?.descuentoMensual ?? 0) / 4) * 100) / 100;

    const desde = new Date(dto.semanaDesde + 'T00:00:00');
    const hasta = new Date(dto.semanaHasta + 'T23:59:59');
    const semanaDesde = new Date(dto.semanaDesde);
    const semanaHasta = new Date(dto.semanaHasta);

    // Viajes ya consumidos por una planilla finalizada (Generada), aprobada o pagada:
    // no vuelven a listarse (incluye "días trabajados" sin comisión).
    const finalizadas = await this.prisma.planilla.findMany({
      where: { sedeId, estado: { in: ['Generada', 'Aprobada', 'Pagada'] } },
      select: { lineas: { select: { viajeId: true } } },
    });
    const consumidos = finalizadas.flatMap((p) => p.lineas.map((l) => l.viajeId)).filter(Boolean);

    // Si ya hay un borrador de este conductor y semana, se le agregan los viajes
    // nuevos (sin borrar lo ya editado); si no, se crea uno nuevo.
    const borrador = await this.prisma.planilla.findFirst({
      where: { sedeId, conductor: dto.conductor, semanaDesde, semanaHasta, estado: 'Borrador' },
      include: { lineas: { orderBy: { orden: 'asc' } } },
    });
    const yaEnBorrador = new Set((borrador?.lineas ?? []).map((l) => l.viajeId).filter(Boolean));

    const viajes = await this.prisma.viaje.findMany({
      where: {
        sedeId,
        conductor: dto.conductor,
        createdAt: { gte: desde, lte: hasta },
        // comisión ya saldada (por planilla o por el módulo de comisiones)
        comisionPagada: false,
        ...(consumidos.length ? { id: { notIn: consumidos } } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
    const nuevos = viajes.filter((v) => !yaEnBorrador.has(v.id));

    // Días que ya tienen sueldo asignado en el borrador: no se paga dos veces el día.
    const diasConSueldo = new Set<string>();
    for (const l of borrador?.lineas ?? []) if (l.sueldoDia > 0) diasConSueldo.add(dayISO(l.fecha));
    const baseOrden = borrador ? borrador.lineas.reduce((m, l) => Math.max(m, l.orden), -1) + 1 : 0;

    const nuevasLineas = nuevos.map((v, i) => {
      const dia = dayISO(v.createdAt);
      const primeraDelDia = !diasConSueldo.has(dia);
      diasConSueldo.add(dia);
      return {
        fecha: new Date(dia),
        cliente: v.cliente || '',
        origen: v.origen || '',
        destino: v.destino || '',
        sueldoDia: primeraDelDia ? sueldoDia : 0,
        comision: v.comisionChofer || 0,
        viaticos: 0,
        concepto: '',
        viajeId: v.id,
        orden: baseOrden + i,
      };
    });

    if (borrador) {
      if (nuevasLineas.length) {
        await this.prisma.planillaLinea.createMany({ data: nuevasLineas.map((l) => ({ ...l, planillaId: borrador.id })) });
      }
      return this.findOne(sedeId, borrador.id);
    }

    const planilla = await this.prisma.planilla.create({
      data: {
        sedeId, conductor: dto.conductor, semanaDesde, semanaHasta,
        sueldoDia, estado: 'Borrador',
        lineas: { create: nuevasLineas },
        // Arranca con la cuota semanal del conductor como primer descuento (si tiene).
        ...(cuotaSemanal > 0 ? { descuentos: { create: [{ concepto: 'Cuota semanal', monto: cuotaSemanal, orden: 0 }] } } : {}),
      },
      include: INCLUDE,
    });
    return this.withTotals(planilla);
  }

  async update(sedeId: string, id: string, dto: UpdatePlanillaDto) {
    const actual = await this.findOne(sedeId, id);
    if (actual.estado === 'Pagada') throw new BadRequestException('La planilla ya está pagada; no se puede editar.');
    const { lineas, descuentos, ...rest } = dto;
    // Líneas y descuentos solo se editan en Borrador (para cambiarlos hay que reabrir).
    if ((lineas || descuentos) && actual.estado !== 'Borrador') {
      throw new BadRequestException('Reabre la planilla para editar sus líneas o descuentos.');
    }
    const data: any = { ...rest };
    // Al reabrir (volver a Borrador) se limpia la aprobación previa.
    if (rest.estado === 'Borrador') { data.aprobadaPor = ''; data.aprobadaEn = null; }

    if (lineas) {
      await this.prisma.planillaLinea.deleteMany({ where: { planillaId: id } });
      await this.prisma.planillaLinea.createMany({
        data: lineas.map((l, i) => ({
          planillaId: id, fecha: new Date(l.fecha), cliente: l.cliente ?? '', origen: l.origen ?? '', destino: l.destino ?? '',
          sueldoDia: l.sueldoDia ?? 0, comision: l.comision ?? 0, viaticos: l.viaticos ?? 0, concepto: l.concepto ?? '',
          viajeId: l.viajeId ?? '', orden: l.orden ?? i,
        })),
      });
    }
    if (descuentos) {
      await this.prisma.planillaDescuento.deleteMany({ where: { planillaId: id } });
      if (descuentos.length) {
        await this.prisma.planillaDescuento.createMany({
          data: descuentos.map((d, i) => ({ planillaId: id, concepto: d.concepto ?? '', monto: d.monto ?? 0, orden: d.orden ?? i })),
        });
      }
    }
    await this.prisma.planilla.update({ where: { id }, data });
    return this.findOne(sedeId, id);
  }

  async remove(sedeId: string, id: string) {
    const p = await this.findOne(sedeId, id);
    const viajeIds = (p.lineas ?? []).map((l: any) => l.viajeId).filter(Boolean);
    // Si la planilla estaba pagada, liberar sus viajes para que vuelvan a estar disponibles.
    await this.prisma.$transaction([
      ...(p.estado === 'Pagada' && viajeIds.length
        ? [this.prisma.viaje.updateMany({ where: { sedeId, id: { in: viajeIds } }, data: { comisionPagada: false, comisionFechaPago: null } })]
        : []),
      this.prisma.planilla.delete({ where: { id } }),
    ]);
    return { ok: true };
  }

  // Finalizada (Generada) → Aprobada. Deja registro de quién aprobó y cuándo.
  async aprobar(sedeId: string, id: string, user: JwtUser) {
    const p = await this.findOne(sedeId, id);
    if (p.estado !== 'Generada') throw new BadRequestException('Solo se puede aprobar una planilla finalizada.');
    await this.prisma.planilla.update({
      where: { id },
      data: { estado: 'Aprobada', aprobadaPor: user.nombre || user.email, aprobadaEn: new Date() },
    });
    return this.findOne(sedeId, id);
  }

  async pagar(sedeId: string, id: string) {
    const p = await this.findOne(sedeId, id);
    // El pago requiere aprobación previa.
    if (p.estado !== 'Aprobada') throw new BadRequestException('La planilla debe estar aprobada antes de pagarse.');
    // Marcar como saldada la comisión de cada viaje incluido en la planilla,
    // para que no se vuelva a jalar en una planilla futura ni figure como pendiente en Comisiones.
    const viajeIds = (p.lineas ?? []).map((l: any) => l.viajeId).filter(Boolean);
    await this.prisma.$transaction([
      this.prisma.planilla.update({ where: { id }, data: { estado: 'Pagada' } }),
      ...(viajeIds.length
        ? [this.prisma.viaje.updateMany({ where: { sedeId, id: { in: viajeIds }, comisionChofer: { gt: 0 } }, data: { comisionPagada: true, comisionFechaPago: new Date() } })]
        : []),
    ]);
    return this.findOne(sedeId, id);
  }

  async reversar(sedeId: string, id: string) {
    const p = await this.findOne(sedeId, id);
    if (p.estado !== 'Pagada') throw new BadRequestException('Solo se puede reversar una planilla pagada.');
    // Vuelve a Borrador (limpia la aprobación) y libera los viajes (comisión otra vez pendiente) para poder corregir.
    const viajeIds = (p.lineas ?? []).map((l: any) => l.viajeId).filter(Boolean);
    await this.prisma.$transaction([
      this.prisma.planilla.update({ where: { id }, data: { estado: 'Borrador', aprobadaPor: '', aprobadaEn: null } }),
      ...(viajeIds.length
        ? [this.prisma.viaje.updateMany({ where: { sedeId, id: { in: viajeIds } }, data: { comisionPagada: false, comisionFechaPago: null } })]
        : []),
    ]);
    return this.findOne(sedeId, id);
  }
}

@Roles('Administrador')
@Controller('planillas')
class PlanillasController {
  constructor(private readonly service: PlanillasService) {}
  @Get('config') config(@CurrentUser() u: JwtUser) { return this.service.config(u.sedeId); }
  @Patch('config') setConfig(@CurrentUser() u: JwtUser, @Body() dto: ConfigDto) { return this.service.setConfig(u.sedeId, dto); }
  @Get() findAll(@CurrentUser() u: JwtUser) { return this.service.findAll(u.sedeId); }
  @Post('generar') generar(@CurrentUser() u: JwtUser, @Body() dto: GenerarDto) { return this.service.generar(u.sedeId, dto); }
  @Get(':id') findOne(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.findOne(u.sedeId, id); }
  @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdatePlanillaDto) { return this.service.update(u.sedeId, id, dto); }
  @Post(':id/aprobar') aprobar(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.aprobar(u.sedeId, id, u); }
  @Post(':id/pagar') pagar(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.pagar(u.sedeId, id); }
  @Post(':id/reversar') reversar(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.reversar(u.sedeId, id); }
  @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.remove(u.sedeId, id); }
}

@Module({ controllers: [PlanillasController], providers: [PlanillasService] })
export class PlanillasModule {}
