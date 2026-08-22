import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
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

class UpdatePlanillaDto {
  @IsNumber() @Min(0) @IsOptional() sueldoDia?: number;
  @IsNumber() @Min(0) @IsOptional() descuentoPlanilla?: number;
  @IsIn(['Borrador', 'Generada', 'Pagada']) @IsOptional() estado?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => LineaDto) @IsOptional() lineas?: LineaDto[];
}

class ConfigDto {
  @IsNumber() @Min(0) sueldoDia: number;
}

const dayISO = (d: Date) => new Date(d).toISOString().slice(0, 10);

@Injectable()
class PlanillasService {
  constructor(private prisma: PrismaService) {}

  withTotals(p: any) {
    const lineas = p.lineas ?? [];
    const totalSueldo = lineas.reduce((s: number, l: any) => s + l.sueldoDia, 0);
    const totalComision = lineas.reduce((s: number, l: any) => s + l.comision, 0);
    const totalViaticos = lineas.reduce((s: number, l: any) => s + l.viaticos, 0);
    const totalPagar = totalSueldo + totalComision + totalViaticos;
    const aDepositar = totalPagar - (p.descuentoPlanilla ?? 0);
    return { ...p, totalSueldo, totalComision, totalViaticos, totalPagar, aDepositar };
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
    const ps = await this.prisma.planilla.findMany({ where: { sedeId }, orderBy: { createdAt: 'desc' }, include: { lineas: true } });
    return ps.map((p) => this.withTotals(p));
  }
  async findOne(sedeId: string, id: string) {
    const p = await this.prisma.planilla.findFirst({ where: { id, sedeId }, include: { lineas: { orderBy: { orden: 'asc' } } } });
    if (!p) throw new NotFoundException('Planilla no encontrada');
    return this.withTotals(p);
  }

  async generar(sedeId: string, dto: GenerarDto) {
    const [sede, cond] = await Promise.all([
      this.prisma.sede.findUnique({ where: { id: sedeId }, select: { sueldoDia: true } }),
      this.prisma.conductor.findFirst({ where: { sedeId, nombre: dto.conductor }, select: { descuentoMensual: true } }),
    ]);
    const sueldoDia = sede?.sueldoDia ?? 0;
    const descuentoPlanilla = Math.round(((cond?.descuentoMensual ?? 0) / 4) * 100) / 100;

    const desde = new Date(dto.semanaDesde + 'T00:00:00');
    const hasta = new Date(dto.semanaHasta + 'T23:59:59');

    // Viajes ya liquidados en una planilla pagada: no deben volver a listarse
    // (incluye los "días trabajados" sin comisión, que no llevan comisionPagada).
    const pagadas = await this.prisma.planilla.findMany({
      where: { sedeId, estado: 'Pagada' },
      select: { lineas: { select: { viajeId: true } } },
    });
    const yaLiquidados = pagadas.flatMap((p) => p.lineas.map((l) => l.viajeId)).filter(Boolean);

    const viajes = await this.prisma.viaje.findMany({
      where: {
        sedeId,
        conductor: dto.conductor,
        createdAt: { gte: desde, lte: hasta },
        // comisión ya saldada (por planilla o por el módulo de comisiones)
        comisionPagada: false,
        ...(yaLiquidados.length ? { id: { notIn: yaLiquidados } } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    const diasVistos = new Set<string>();
    const lineas = viajes.map((v, i) => {
      const dia = dayISO(v.createdAt);
      const primeraDelDia = !diasVistos.has(dia);
      diasVistos.add(dia);
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
        orden: i,
      };
    });

    const planilla = await this.prisma.planilla.create({
      data: {
        sedeId, conductor: dto.conductor, semanaDesde: new Date(dto.semanaDesde), semanaHasta: new Date(dto.semanaHasta),
        sueldoDia, descuentoPlanilla, estado: 'Borrador', lineas: { create: lineas },
      },
      include: { lineas: { orderBy: { orden: 'asc' } } },
    });
    return this.withTotals(planilla);
  }

  async update(sedeId: string, id: string, dto: UpdatePlanillaDto) {
    await this.findOne(sedeId, id);
    const { lineas, ...rest } = dto;
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
    await this.prisma.planilla.update({ where: { id }, data: rest });
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

  async pagar(sedeId: string, id: string) {
    const p = await this.findOne(sedeId, id);
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
  @Post(':id/pagar') pagar(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.pagar(u.sedeId, id); }
  @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.remove(u.sedeId, id); }
}

@Module({ controllers: [PlanillasController], providers: [PlanillasService] })
export class PlanillasModule {}
