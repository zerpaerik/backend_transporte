import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser, JwtUser } from '../common/decorators';

const DIAS_ARCHIVAR = 15; // días en "Devuelto" antes de quitarlo del índice de devoluciones

class UpdateDevolucionDto {
  @IsDateString() @IsOptional() citaFecha?: string;
  @IsString() @IsOptional() citaHora?: string;
  @IsString() @IsOptional() lugarGuardado?: string;
  @IsIn(['Pendiente', 'En proceso', 'Devuelto']) @IsOptional() estadoDevolucion?: string;
}

class ArchivoDto {
  @IsString() @IsNotEmpty() archivoBase64: string;
  @IsString() @IsOptional() nombre?: string;
  @IsString() @IsOptional() mime?: string;
}

class LugarDto {
  @IsString() @IsNotEmpty() nombre: string;
}

// Un viaje es de importación si su operación empieza por "IMPO" (cubre "IMPO" e "IMPORTACION").
const esImport = (op: string) => (op || '').toUpperCase().startsWith('IMPO');

// Campos que se devuelven (sin los binarios: los archivos van solo con su metadato).
const DEV_SELECT = {
  id: true, codigo: true, placaTracto: true, carreta: true, conductor: true, cliente: true,
  contenedor: true, tamanio: true, destino: true, devolucion: true, operacion: true, createdAt: true,
  citaFecha: true, citaHora: true, lugarGuardado: true, estadoDevolucion: true, devueltoEn: true,
  citaArchivos: { select: { id: true, nombre: true, mime: true } },
};

@Injectable()
class DevolucionesService {
  constructor(private prisma: PrismaService) {}

  // Quita del índice (archiva) los contenedores con 15+ días en "Devuelto". No toca el
  // viaje en Operaciones; solo lo saca de devoluciones y libera sus adjuntos.
  private async archivarVencidos(sedeId: string) {
    const limite = new Date(Date.now() - DIAS_ARCHIVAR * 86_400_000);
    const vencidos = await this.prisma.viaje.findMany({
      where: { sedeId, estadoDevolucion: 'Devuelto', devolucionArchivada: false, devueltoEn: { lte: limite } },
      select: { id: true },
    });
    if (!vencidos.length) return;
    const ids = vencidos.map((v) => v.id);
    await this.prisma.$transaction([
      this.prisma.citaArchivo.deleteMany({ where: { viajeId: { in: ids } } }),
      this.prisma.viaje.updateMany({ where: { id: { in: ids } }, data: { devolucionArchivada: true } }),
    ]);
  }

  async list(sedeId: string) {
    await this.archivarVencidos(sedeId);
    const viajes = await this.prisma.viaje.findMany({
      where: { sedeId, devolucionArchivada: false, estado: { not: 'Cancelado' } },
      orderBy: { createdAt: 'desc' },
      select: DEV_SELECT,
    });
    return viajes.filter((v) => esImport(v.operacion));
  }

  async update(sedeId: string, viajeId: string, dto: UpdateDevolucionDto) {
    const v = await this.prisma.viaje.findFirst({ where: { id: viajeId, sedeId } });
    if (!v) throw new NotFoundException('Viaje no encontrado');
    const data: any = {};
    if (dto.citaFecha !== undefined) data.citaFecha = dto.citaFecha ? new Date(dto.citaFecha) : null;
    if (dto.citaHora !== undefined) data.citaHora = dto.citaHora;
    if (dto.lugarGuardado !== undefined) data.lugarGuardado = dto.lugarGuardado;
    if (dto.estadoDevolucion !== undefined) {
      data.estadoDevolucion = dto.estadoDevolucion;
      // El reloj de los 15 días arranca cuando pasa a "Devuelto"; si sale de ese estado, se reinicia.
      data.devueltoEn = dto.estadoDevolucion === 'Devuelto' ? (v.estadoDevolucion === 'Devuelto' ? v.devueltoEn : new Date()) : null;
    }
    await this.prisma.viaje.update({ where: { id: viajeId }, data });
    return this.prisma.viaje.findFirst({ where: { id: viajeId, sedeId }, select: DEV_SELECT });
  }

  // ---- Archivos de la cita (varios por viaje) ----
  async agregarArchivo(sedeId: string, viajeId: string, dto: ArchivoDto) {
    const v = await this.prisma.viaje.findFirst({ where: { id: viajeId, sedeId } });
    if (!v) throw new NotFoundException('Viaje no encontrado');
    await this.prisma.citaArchivo.create({
      data: { viajeId, archivo: Buffer.from(dto.archivoBase64, 'base64'), nombre: dto.nombre ?? 'cita', mime: dto.mime ?? 'application/pdf' },
    });
    return this.prisma.viaje.findFirst({ where: { id: viajeId, sedeId }, select: DEV_SELECT });
  }

  async quitarArchivo(sedeId: string, viajeId: string, archivoId: string) {
    const a = await this.prisma.citaArchivo.findFirst({ where: { id: archivoId, viajeId, viaje: { sedeId } } });
    if (!a) throw new NotFoundException('Archivo no encontrado');
    await this.prisma.citaArchivo.delete({ where: { id: archivoId } });
    return this.prisma.viaje.findFirst({ where: { id: viajeId, sedeId }, select: DEV_SELECT });
  }

  async descargarArchivo(sedeId: string, archivoId: string) {
    const a = await this.prisma.citaArchivo.findFirst({ where: { id: archivoId, viaje: { sedeId } } });
    if (!a) throw new NotFoundException('Archivo no encontrado');
    return { nombre: a.nombre, mime: a.mime, base64: Buffer.from(a.archivo).toString('base64') };
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
  @Post('devoluciones/:viajeId/archivos') agregarArchivo(@CurrentUser() u: JwtUser, @Param('viajeId') id: string, @Body() dto: ArchivoDto) { return this.service.agregarArchivo(u.sedeId, id, dto); }
  @Delete('devoluciones/:viajeId/archivos/:archivoId') quitarArchivo(@CurrentUser() u: JwtUser, @Param('viajeId') id: string, @Param('archivoId') archivoId: string) { return this.service.quitarArchivo(u.sedeId, id, archivoId); }
  @Get('devoluciones/:viajeId/archivos/:archivoId') descargarArchivo(@CurrentUser() u: JwtUser, @Param('archivoId') archivoId: string) { return this.service.descargarArchivo(u.sedeId, archivoId); }

  @Get('lugares-guardado') lugares(@CurrentUser() u: JwtUser) { return this.service.lugares(u.sedeId); }
  @Post('lugares-guardado') crearLugar(@CurrentUser() u: JwtUser, @Body() dto: LugarDto) { return this.service.crearLugar(u.sedeId, dto); }
  @Delete('lugares-guardado/:id') borrarLugar(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.borrarLugar(u.sedeId, id); }
}

@Module({ controllers: [DevolucionesController], providers: [DevolucionesService] })
export class DevolucionesModule {}
