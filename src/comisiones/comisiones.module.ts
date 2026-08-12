import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser, JwtUser } from '../common/decorators';

class CreateComisionDto {
  @IsString() @IsNotEmpty() destino: string;
  @IsNumber() @Min(0) @IsOptional() gral?: number;
  @IsNumber() @Min(0) @IsOptional() imo?: number;
  @IsNumber() @Min(0) @IsOptional() reefer?: number;
}
class UpdateComisionDto extends PartialType(CreateComisionDto) {}

const norm = (s: string) => (s || '').normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]','g'),'').trim().toUpperCase();

@Injectable()
export class ComisionesService {
  constructor(private prisma: PrismaService) {}

  // ---- Tarifario ----
  findAll(sedeId: string) { return this.prisma.comision.findMany({ where: { sedeId }, orderBy: { destino: 'asc' } }); }
  create(sedeId: string, dto: CreateComisionDto) {
    return this.prisma.comision.create({ data: { destino: dto.destino, gral: dto.gral ?? 0, imo: dto.imo ?? 0, reefer: dto.reefer ?? 0, sedeId } });
  }
  async update(sedeId: string, id: string, dto: UpdateComisionDto) {
    const c = await this.prisma.comision.findFirst({ where: { id, sedeId } });
    if (!c) throw new NotFoundException('Tarifa no encontrada');
    return this.prisma.comision.update({ where: { id }, data: dto });
  }
  async remove(sedeId: string, id: string) {
    const c = await this.prisma.comision.findFirst({ where: { id, sedeId } });
    if (!c) throw new NotFoundException('Tarifa no encontrada');
    return this.prisma.comision.delete({ where: { id } });
  }

  // Monto de bono para (destino, tipo de carga)
  async montoPara(sedeId: string, destino: string, tipoCarga: string): Promise<number> {
    if (!destino) return 0;
    const all = await this.prisma.comision.findMany({ where: { sedeId } });
    const hit = all.find((c) => norm(c.destino) === norm(destino));
    if (!hit) return 0;
    const t = norm(tipoCarga);
    if (t.startsWith('IMO')) return hit.imo;
    if (t.startsWith('REEF')) return hit.reefer;
    return hit.gral; // GENERAL / GRAL / por defecto
  }

  // ---- Resumen por chofer (pendiente vs pagado) ----
  async resumen(sedeId: string) {
    const viajes = await this.prisma.viaje.findMany({
      where: { sedeId, comisionChofer: { gt: 0 } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, codigo: true, conductor: true, origen: true, destino: true, tipoCarga: true, comisionChofer: true, comisionPagada: true, comisionFechaPago: true, createdAt: true },
    });
    const map: Record<string, any> = {};
    for (const v of viajes) {
      const k = v.conductor || 'Sin asignar';
      map[k] ??= { conductor: k, pendiente: 0, pagado: 0, viajes: [] as any[] };
      if (v.comisionPagada) map[k].pagado += v.comisionChofer;
      else map[k].pendiente += v.comisionChofer;
      map[k].viajes.push(v);
    }
    return Object.values(map).sort((a: any, b: any) => b.pendiente - a.pendiente);
  }

  async pagarViaje(sedeId: string, viajeId: string) {
    const v = await this.prisma.viaje.findFirst({ where: { id: viajeId, sedeId } });
    if (!v) throw new NotFoundException('Viaje no encontrado');
    return this.prisma.viaje.update({ where: { id: viajeId }, data: { comisionPagada: true, comisionFechaPago: new Date() } });
  }
  async pagarConductor(sedeId: string, conductor: string) {
    const r = await this.prisma.viaje.updateMany({
      where: { sedeId, conductor, comisionPagada: false, comisionChofer: { gt: 0 } },
      data: { comisionPagada: true, comisionFechaPago: new Date() },
    });
    return { pagados: r.count };
  }
}

@Controller('comisiones')
class ComisionesController {
  constructor(private readonly service: ComisionesService) {}
  @Get() findAll(@CurrentUser() u: JwtUser) { return this.service.findAll(u.sedeId); }
  @Get('resumen') resumen(@CurrentUser() u: JwtUser) { return this.service.resumen(u.sedeId); }
  @Roles('Administrador') @Post() create(@CurrentUser() u: JwtUser, @Body() dto: CreateComisionDto) { return this.service.create(u.sedeId, dto); }
  @Roles('Administrador') @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateComisionDto) { return this.service.update(u.sedeId, id, dto); }
  @Roles('Administrador') @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.remove(u.sedeId, id); }
  @Roles('Administrador') @Post('pagar/:viajeId') pagarViaje(@CurrentUser() u: JwtUser, @Param('viajeId') viajeId: string) { return this.service.pagarViaje(u.sedeId, viajeId); }
  @Roles('Administrador') @Post('pagar-conductor') pagarConductor(@CurrentUser() u: JwtUser, @Body() body: { conductor: string }) { return this.service.pagarConductor(u.sedeId, body.conductor); }
}

@Module({ controllers: [ComisionesController], providers: [ComisionesService], exports: [ComisionesService] })
export class ComisionesModule {}
