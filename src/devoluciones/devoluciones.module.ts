import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser, JwtUser } from '../common/decorators';

class UpdateDevolucionDto {
  @IsDateString() @IsOptional() citaFecha?: string;
  @IsString() @IsOptional() citaHora?: string;
  @IsString() @IsOptional() lugarGuardado?: string;
  @IsIn(['Pendiente', 'En proceso', 'Devuelto']) @IsOptional() estadoDevolucion?: string;
  @IsString() @IsOptional() archivoBase64?: string;
  @IsString() @IsOptional() archivoNombre?: string;
  @IsString() @IsOptional() archivoMime?: string;
}

class LugarDto {
  @IsString() @IsNotEmpty() nombre: string;
}

// Un viaje es de importación si su operación empieza por "IMPO" (cubre "IMPO" e "IMPORTACION").
const esImport = (op: string) => (op || '').toUpperCase().startsWith('IMPO');

// Campos que se devuelven (sin el binario del adjunto).
const DEV_SELECT = {
  id: true, codigo: true, placaTracto: true, carreta: true, conductor: true, cliente: true,
  contenedor: true, tamanio: true, destino: true, devolucion: true, operacion: true, createdAt: true,
  citaFecha: true, citaHora: true, lugarGuardado: true, estadoDevolucion: true, citaArchivoNombre: true,
};

@Injectable()
class DevolucionesService {
  constructor(private prisma: PrismaService) {}

  async list(sedeId: string) {
    const viajes = await this.prisma.viaje.findMany({ where: { sedeId }, orderBy: { createdAt: 'desc' }, select: DEV_SELECT });
    return viajes.filter((v) => esImport(v.operacion));
  }

  async update(sedeId: string, viajeId: string, dto: UpdateDevolucionDto) {
    const v = await this.prisma.viaje.findFirst({ where: { id: viajeId, sedeId } });
    if (!v) throw new NotFoundException('Viaje no encontrado');
    const data: any = {};
    if (dto.citaFecha !== undefined) data.citaFecha = dto.citaFecha ? new Date(dto.citaFecha) : null;
    if (dto.citaHora !== undefined) data.citaHora = dto.citaHora;
    if (dto.lugarGuardado !== undefined) data.lugarGuardado = dto.lugarGuardado;
    if (dto.estadoDevolucion !== undefined) data.estadoDevolucion = dto.estadoDevolucion;
    if (dto.archivoBase64) {
      data.citaArchivo = Buffer.from(dto.archivoBase64, 'base64');
      data.citaArchivoNombre = dto.archivoNombre ?? 'cita';
      data.citaArchivoMime = dto.archivoMime ?? 'application/pdf';
    }
    await this.prisma.viaje.update({ where: { id: viajeId }, data });
    return this.prisma.viaje.findFirst({ where: { id: viajeId, sedeId }, select: DEV_SELECT });
  }

  async archivo(sedeId: string, viajeId: string) {
    const v = await this.prisma.viaje.findFirst({ where: { id: viajeId, sedeId } });
    if (!v || !v.citaArchivo) throw new NotFoundException('Este viaje no tiene cita adjunta');
    return { nombre: v.citaArchivoNombre ?? 'cita', mime: v.citaArchivoMime ?? 'application/pdf', base64: Buffer.from(v.citaArchivo).toString('base64') };
  }

  // ---- Catálogo de lugares de guardado ----
  lugares(sedeId: string) { return this.prisma.lugarGuardado.findMany({ where: { sedeId, activo: true }, orderBy: { nombre: 'asc' } }); }
  crearLugar(sedeId: string, dto: LugarDto) { return this.prisma.lugarGuardado.create({ data: { nombre: dto.nombre.trim(), sedeId } }); }
  async borrarLugar(sedeId: string, id: string) {
    const l = await this.prisma.lugarGuardado.findFirst({ where: { id, sedeId } });
    if (!l) throw new NotFoundException('Lugar no encontrado');
    await this.prisma.lugarGuardado.delete({ where: { id } });
    return { ok: true };
  }
}

@Roles('Administrador', 'Operador')
@Controller()
class DevolucionesController {
  constructor(private readonly service: DevolucionesService) {}
  @Get('devoluciones') list(@CurrentUser() u: JwtUser) { return this.service.list(u.sedeId); }
  @Patch('devoluciones/:viajeId') update(@CurrentUser() u: JwtUser, @Param('viajeId') id: string, @Body() dto: UpdateDevolucionDto) { return this.service.update(u.sedeId, id, dto); }
  @Get('devoluciones/:viajeId/archivo') archivo(@CurrentUser() u: JwtUser, @Param('viajeId') id: string) { return this.service.archivo(u.sedeId, id); }

  @Get('lugares-guardado') lugares(@CurrentUser() u: JwtUser) { return this.service.lugares(u.sedeId); }
  @Post('lugares-guardado') crearLugar(@CurrentUser() u: JwtUser, @Body() dto: LugarDto) { return this.service.crearLugar(u.sedeId, dto); }
  @Delete('lugares-guardado/:id') borrarLugar(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.borrarLugar(u.sedeId, id); }
}

@Module({ controllers: [DevolucionesController], providers: [DevolucionesService] })
export class DevolucionesModule {}
