import { Module, Injectable, BadRequestException, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { IsDateString, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser, JwtUser } from '../common/decorators';

const DIAS_ARCHIVAR = 15; // días en "Devuelto" antes de quitarlo del índice de devoluciones

class UpdateDevolucionDto {
  @IsDateString() @IsOptional() citaFecha?: string;
  @IsString() @IsOptional() citaHora?: string;
  @IsString() @IsOptional() lugarGuardado?: string;
  @IsIn(['Pendiente', 'En proceso', 'Devuelto']) @IsOptional() estadoDevolucion?: string;
  @IsString() @IsOptional() devueltoPor?: string; // conductor que efectivamente devolvió
}

class CompensarDto {
  @IsIn(['Pendiente', 'Compensada', 'Pagada']) estado: string;
  @IsNumber() @Min(0) @IsOptional() monto?: number; // solo si se paga
  @IsString() @IsOptional() nota?: string;
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

// Hay cruce (y por tanto compensación) cuando el contenedor lo devolvió un conductor
// distinto al del viaje. Se compara sin espacios de sobra, como llega del formulario.
const esCruce = (conductor: string, devueltoPor: string) => {
  const quien = (devueltoPor || '').trim();
  return !!quien && quien !== (conductor || '').trim();
};

// Campos que se devuelven (sin los binarios: los archivos van solo con su metadato).
const DEV_SELECT = {
  id: true, codigo: true, placaTracto: true, carreta: true, conductor: true, cliente: true,
  contenedor: true, tamanio: true, destino: true, devolucion: true, operacion: true, createdAt: true,
  citaFecha: true, citaHora: true, lugarGuardado: true, estadoDevolucion: true, devueltoEn: true,
  devueltoPor: true, devueltoPorEn: true, compensacionEstado: true, compensacionMonto: true,
  compensacionNota: true, compensacionEn: true,
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
    if (dto.devueltoPor !== undefined) {
      const quien = dto.devueltoPor.trim();
      data.devueltoPor = quien;
      // Si devolvió un conductor distinto al del viaje, queda una compensación pendiente
      // (el dueño le debe una devolución al que la hizo). Si lo devolvió el mismo, se limpia.
      if (!esCruce(v.conductor, quien)) {
        data.devueltoPorEn = null;
        data.compensacionEstado = '';
        data.compensacionMonto = 0;
        data.compensacionNota = '';
        data.compensacionEn = null;
      } else if (!v.compensacionEstado || quien !== (v.devueltoPor || '').trim()) {
        // Nueva, o corrigieron a quién se le debe: lo saldado antes ya no aplica.
        data.devueltoPorEn = new Date();
        data.compensacionEstado = 'Pendiente';
        data.compensacionMonto = 0;
        data.compensacionNota = '';
        data.compensacionEn = null;
      } else if (!v.devueltoPorEn) {
        // Cruce de antes de que se guardara la fecha: se fecha ahora y no se vuelve a tocar.
        data.devueltoPorEn = new Date();
      }
    }
    await this.prisma.viaje.update({ where: { id: viajeId }, data });
    return this.prisma.viaje.findFirst({ where: { id: viajeId, sedeId }, select: DEV_SELECT });
  }

  // Marca una compensación como Compensada (con otra devolución) o Pagada (con monto).
  async compensar(sedeId: string, viajeId: string, dto: CompensarDto) {
    const v = await this.prisma.viaje.findFirst({ where: { id: viajeId, sedeId } });
    if (!v) throw new NotFoundException('Viaje no encontrado');
    // Solo hay algo que compensar si el contenedor lo devolvió un conductor distinto.
    if (!esCruce(v.conductor, v.devueltoPor)) {
      throw new BadRequestException('Este contenedor lo devolvió su propio conductor: no hay compensación que registrar.');
    }
    const saldada = dto.estado === 'Compensada' || dto.estado === 'Pagada';
    await this.prisma.viaje.update({
      where: { id: viajeId },
      data: {
        compensacionEstado: dto.estado,
        compensacionMonto: dto.estado === 'Pagada' ? (dto.monto ?? 0) : 0,
        compensacionNota: dto.nota ?? '',
        // Fecha del saldo: es la que necesita planilla para saber en qué periodo cae.
        compensacionEn: saldada ? new Date() : null,
      },
    });
    return this.prisma.viaje.findFirst({ where: { id: viajeId, sedeId }, select: DEV_SELECT });
  }

  // Cruces (devolvió un conductor distinto) y saldo por conductor (pendientes).
  // A diferencia del índice, aquí NO se excluyen los archivados: la deuda entre
  // conductores sigue viva aunque el contenedor ya se haya archivado a los 15 días.
  async compensaciones(sedeId: string) {
    const viajes = await this.prisma.viaje.findMany({
      where: { sedeId, devueltoPor: { not: '' }, estado: { not: 'Cancelado' } },
      // La devolución registrada más recientemente va arriba (las sin fecha, al final).
      orderBy: [{ devueltoPorEn: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      select: {
        id: true, codigo: true, contenedor: true, conductor: true, devueltoPor: true, devueltoEn: true,
        devueltoPorEn: true, citaFecha: true, estadoDevolucion: true, compensacionEstado: true,
        compensacionMonto: true, compensacionNota: true, compensacionEn: true, cliente: true,
      },
    });
    const cruces = viajes.filter((v) => esCruce(v.conductor, v.devueltoPor));
    const saldos: Record<string, { conductor: string; aFavor: number; enContra: number }> = {};
    for (const c of cruces) {
      if (c.compensacionEstado === 'Compensada' || c.compensacionEstado === 'Pagada') continue; // ya saldado
      (saldos[c.devueltoPor] ||= { conductor: c.devueltoPor, aFavor: 0, enContra: 0 }).aFavor++; // hizo la devolución por otro
      // El conductor del viaje queda debiendo una devolución al que se la hizo.
      if (c.conductor) (saldos[c.conductor] ||= { conductor: c.conductor, aFavor: 0, enContra: 0 }).enContra++;
    }
    const saldosArr = Object.values(saldos)
      .map((s) => ({ ...s, saldo: s.aFavor - s.enContra }))
      .sort((a, b) => b.saldo - a.saldo);
    return { cruces, saldos: saldosArr };
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
  @Get('devoluciones/compensaciones') compensaciones(@CurrentUser() u: JwtUser) { return this.service.compensaciones(u.sedeId); }
  @Patch('devoluciones/:viajeId') update(@CurrentUser() u: JwtUser, @Param('viajeId') id: string, @Body() dto: UpdateDevolucionDto) { return this.service.update(u.sedeId, id, dto); }
  @Patch('devoluciones/:viajeId/compensacion') compensar(@CurrentUser() u: JwtUser, @Param('viajeId') id: string, @Body() dto: CompensarDto) { return this.service.compensar(u.sedeId, id, dto); }
  @Post('devoluciones/:viajeId/archivos') agregarArchivo(@CurrentUser() u: JwtUser, @Param('viajeId') id: string, @Body() dto: ArchivoDto) { return this.service.agregarArchivo(u.sedeId, id, dto); }
  @Delete('devoluciones/:viajeId/archivos/:archivoId') quitarArchivo(@CurrentUser() u: JwtUser, @Param('viajeId') id: string, @Param('archivoId') archivoId: string) { return this.service.quitarArchivo(u.sedeId, id, archivoId); }
  @Get('devoluciones/:viajeId/archivos/:archivoId') descargarArchivo(@CurrentUser() u: JwtUser, @Param('archivoId') archivoId: string) { return this.service.descargarArchivo(u.sedeId, archivoId); }

  @Get('lugares-guardado') lugares(@CurrentUser() u: JwtUser) { return this.service.lugares(u.sedeId); }
  @Post('lugares-guardado') crearLugar(@CurrentUser() u: JwtUser, @Body() dto: LugarDto) { return this.service.crearLugar(u.sedeId, dto); }
  @Delete('lugares-guardado/:id') borrarLugar(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.borrarLugar(u.sedeId, id); }
}

@Module({ controllers: [DevolucionesController], providers: [DevolucionesService] })
export class DevolucionesModule {}
