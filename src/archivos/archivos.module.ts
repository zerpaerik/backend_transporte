import { Module, Injectable, NotFoundException, BadRequestException, Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { IsOptional, IsString, IsNotEmpty, IsInt } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser, JwtUser } from '../common/decorators';

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB por archivo
const ARCHIVO_SELECT = { id: true, nombre: true, mime: true, size: true, createdAt: true, carpetaId: true };
const MESES = ['01 Enero', '02 Febrero', '03 Marzo', '04 Abril', '05 Mayo', '06 Junio', '07 Julio', '08 Agosto', '09 Septiembre', '10 Octubre', '11 Noviembre', '12 Diciembre'];

// Estructura base que se crea en cada sede (idempotente).
const BASE: { nombre: string; hijos?: string[] }[] = [
  { nombre: 'CONTABILIDAD', hijos: ['COMPRAS', 'VENTAS'] },
  { nombre: 'PLANILLA' },
  { nombre: 'BANCOS' },
  { nombre: 'TRIBUTOS' },
  { nombre: 'DETRACCIONES' },
  { nombre: 'PENDIENTES' },
];

class CrearCarpetaDto {
  @IsString() @IsNotEmpty() nombre: string;
  @IsString() @IsOptional() parentId?: string;
}
class RenombrarDto {
  @IsString() @IsNotEmpty() nombre: string;
}
class MesesDto {
  @IsInt() @IsOptional() anio?: number;
}
class SubirDto {
  @IsString() @IsNotEmpty() carpetaId: string;
  @IsString() @IsNotEmpty() nombre: string;
  @IsString() @IsOptional() mime?: string;
  @IsString() @IsNotEmpty() base64: string;
}

@Injectable()
class ArchivosService {
  constructor(private prisma: PrismaService) {}

  private async carpetaDeSede(sedeId: string, id: string) {
    const c = await this.prisma.carpeta.findFirst({ where: { id, sedeId } });
    if (!c) throw new NotFoundException('Carpeta no encontrada');
    return c;
  }

  async listar(sedeId: string, carpetaId?: string) {
    let carpeta = null as any;
    const ruta: { id: string; nombre: string }[] = [];
    if (carpetaId) {
      carpeta = await this.carpetaDeSede(sedeId, carpetaId);
      // Migas de pan: subir por los padres.
      let cur: any = carpeta;
      while (cur) {
        ruta.unshift({ id: cur.id, nombre: cur.nombre });
        cur = cur.parentId ? await this.prisma.carpeta.findUnique({ where: { id: cur.parentId } }) : null;
      }
    }
    const [subcarpetas, archivos] = await Promise.all([
      this.prisma.carpeta.findMany({ where: { sedeId, parentId: carpetaId ?? null }, orderBy: { nombre: 'asc' } }),
      carpetaId
        ? this.prisma.archivo.findMany({ where: { sedeId, carpetaId }, select: ARCHIVO_SELECT, orderBy: { nombre: 'asc' } })
        : Promise.resolve([]),
    ]);
    // Conteo de contenido por subcarpeta (para mostrar "3 elementos").
    const conteos = await Promise.all(
      subcarpetas.map(async (s) => {
        const [nc, na] = await Promise.all([
          this.prisma.carpeta.count({ where: { parentId: s.id } }),
          this.prisma.archivo.count({ where: { carpetaId: s.id } }),
        ]);
        return { id: s.id, items: nc + na };
      }),
    );
    const items: Record<string, number> = Object.fromEntries(conteos.map((c) => [c.id, c.items]));
    return {
      carpeta,
      ruta,
      subcarpetas: subcarpetas.map((s) => ({ id: s.id, nombre: s.nombre, parentId: s.parentId, items: items[s.id] ?? 0 })),
      archivos,
    };
  }

  async crearCarpeta(sedeId: string, dto: CrearCarpetaDto) {
    if (dto.parentId) await this.carpetaDeSede(sedeId, dto.parentId);
    return this.prisma.carpeta.create({ data: { sedeId, nombre: dto.nombre.trim(), parentId: dto.parentId ?? null } });
  }
  async renombrar(sedeId: string, id: string, nombre: string) {
    await this.carpetaDeSede(sedeId, id);
    return this.prisma.carpeta.update({ where: { id }, data: { nombre: nombre.trim() } });
  }
  async borrarCarpeta(sedeId: string, id: string) {
    await this.carpetaDeSede(sedeId, id);
    await this.prisma.carpeta.delete({ where: { id } }); // cascada: subcarpetas y archivos
    return { ok: true };
  }
  async crearMeses(sedeId: string, carpetaId: string, anio?: number) {
    await this.carpetaDeSede(sedeId, carpetaId);
    const existentes = new Set((await this.prisma.carpeta.findMany({ where: { sedeId, parentId: carpetaId }, select: { nombre: true } })).map((c) => c.nombre));
    let creadas = 0;
    for (const m of MESES) {
      const nombre = anio ? `${m} ${anio}` : m;
      if (existentes.has(nombre)) continue;
      await this.prisma.carpeta.create({ data: { sedeId, nombre, parentId: carpetaId } });
      creadas++;
    }
    return { creadas };
  }

  async subir(sedeId: string, dto: SubirDto) {
    await this.carpetaDeSede(sedeId, dto.carpetaId);
    const data = Buffer.from(dto.base64, 'base64');
    if (data.length === 0) throw new BadRequestException('El archivo está vacío.');
    if (data.length > MAX_BYTES) throw new BadRequestException('El archivo supera el límite de 20 MB.');
    const a = await this.prisma.archivo.create({
      data: { sedeId, carpetaId: dto.carpetaId, nombre: dto.nombre, mime: dto.mime ?? 'application/octet-stream', size: data.length, data },
      select: ARCHIVO_SELECT,
    });
    return a;
  }
  async descargar(sedeId: string, id: string) {
    const a = await this.prisma.archivo.findFirst({ where: { id, sedeId } });
    if (!a) throw new NotFoundException('Archivo no encontrado');
    return { nombre: a.nombre, mime: a.mime, base64: Buffer.from(a.data).toString('base64') };
  }
  async renombrarArchivo(sedeId: string, id: string, nombre: string) {
    const a = await this.prisma.archivo.findFirst({ where: { id, sedeId }, select: { id: true } });
    if (!a) throw new NotFoundException('Archivo no encontrado');
    return this.prisma.archivo.update({ where: { id }, data: { nombre: nombre.trim() }, select: ARCHIVO_SELECT });
  }
  async borrarArchivo(sedeId: string, id: string) {
    const a = await this.prisma.archivo.findFirst({ where: { id, sedeId }, select: { id: true } });
    if (!a) throw new NotFoundException('Archivo no encontrado');
    await this.prisma.archivo.delete({ where: { id } });
    return { ok: true };
  }

  // Crea la estructura base si la sede no tiene carpetas raíz. Idempotente.
  async sembrarBase(sedeId: string) {
    const raiz = await this.prisma.carpeta.count({ where: { sedeId, parentId: null } });
    if (raiz > 0) return { creada: false };
    for (const top of BASE) {
      const c = await this.prisma.carpeta.create({ data: { sedeId, nombre: top.nombre, parentId: null } });
      for (const h of top.hijos ?? []) await this.prisma.carpeta.create({ data: { sedeId, nombre: h, parentId: c.id } });
    }
    return { creada: true };
  }
}

@Roles('Administrador', 'Contable')
@Controller('archivos')
class ArchivosController {
  constructor(private readonly service: ArchivosService) {}
  @Get() listar(@CurrentUser() u: JwtUser, @Query('carpetaId') carpetaId?: string) { return this.service.listar(u.sedeId, carpetaId); }
  @Post('carpetas') crear(@CurrentUser() u: JwtUser, @Body() dto: CrearCarpetaDto) { return this.service.crearCarpeta(u.sedeId, dto); }
  @Patch('carpetas/:id') renombrar(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: RenombrarDto) { return this.service.renombrar(u.sedeId, id, dto.nombre); }
  @Delete('carpetas/:id') borrarCarpeta(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.borrarCarpeta(u.sedeId, id); }
  @Post('carpetas/:id/meses') meses(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: MesesDto) { return this.service.crearMeses(u.sedeId, id, dto.anio); }
  @Post('sembrar') sembrar(@CurrentUser() u: JwtUser) { return this.service.sembrarBase(u.sedeId); }
  @Post() subir(@CurrentUser() u: JwtUser, @Body() dto: SubirDto) { return this.service.subir(u.sedeId, dto); }
  @Get(':id/descargar') descargar(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.descargar(u.sedeId, id); }
  @Patch(':id') renombrarArchivo(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: RenombrarDto) { return this.service.renombrarArchivo(u.sedeId, id, dto.nombre); }
  @Delete(':id') borrarArchivo(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.borrarArchivo(u.sedeId, id); }
}

@Module({ controllers: [ArchivosController], providers: [ArchivosService] })
export class ArchivosModule {}
