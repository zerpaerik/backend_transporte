import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsInt, IsOptional, IsString, Min, IsNotEmpty, IsDateString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser, JwtUser } from '../common/decorators';

class CreateVehiculoDto {
  @IsString() @IsNotEmpty() placa: string;
  @IsIn(['Tracto', 'Carreta']) tipo: string;
  @IsString() @IsNotEmpty() marca: string;
  @IsString() @IsOptional() modelo?: string;
  @IsInt() anio: number;
  @IsInt() @Min(0) @IsOptional() kilometraje?: number;
  @IsIn(['Operativo', 'En taller', 'Inactivo']) @IsOptional() estado?: string;
}
class UpdateVehiculoDto extends PartialType(CreateVehiculoDto) {}

class DocumentoDto {
  @IsString() @IsNotEmpty() tipo: string;
  @IsString() @IsOptional() numero?: string;
  @IsDateString() vencimiento: string;
  @IsString() @IsOptional() archivoBase64?: string;
  @IsString() @IsOptional() archivoNombre?: string;
  @IsString() @IsOptional() archivoMime?: string;
}
class RenovarDocumentoDto extends PartialType(DocumentoDto) {}

const DOC_SELECT = { id: true, tipo: true, numero: true, vencimiento: true, archivoNombre: true, archivoMime: true };

function mapDoc(dto: DocumentoDto | RenovarDocumentoDto) {
  const base: any = {};
  if (dto.tipo !== undefined) base.tipo = dto.tipo;
  if (dto.numero !== undefined) base.numero = dto.numero;
  if (dto.vencimiento) base.vencimiento = new Date(dto.vencimiento);
  if (dto.archivoBase64) {
    base.archivo = Buffer.from(dto.archivoBase64, 'base64');
    base.archivoNombre = dto.archivoNombre ?? 'documento.pdf';
    base.archivoMime = dto.archivoMime ?? 'application/pdf';
  }
  return base;
}

@Injectable()
class VehiculosService {
  constructor(private prisma: PrismaService) {}
  findAll(sedeId: string) { return this.prisma.vehiculo.findMany({ where: { sedeId }, orderBy: { createdAt: 'desc' }, include: { documentos: { select: DOC_SELECT } } }); }
  async findOne(sedeId: string, id: string) {
    const v = await this.prisma.vehiculo.findFirst({ where: { id, sedeId }, include: { documentos: { select: DOC_SELECT } } });
    if (!v) throw new NotFoundException('Vehículo no encontrado');
    return v;
  }
  create(sedeId: string, dto: CreateVehiculoDto) { return this.prisma.vehiculo.create({ data: { ...dto, sedeId } as any }); }
  async update(sedeId: string, id: string, dto: UpdateVehiculoDto) { await this.findOne(sedeId, id); return this.prisma.vehiculo.update({ where: { id }, data: dto, include: { documentos: { select: DOC_SELECT } } }); }
  async remove(sedeId: string, id: string) { await this.findOne(sedeId, id); return this.prisma.vehiculo.delete({ where: { id } }); }

  // --- Documentos ---
  async addDoc(sedeId: string, id: string, dto: DocumentoDto) {
    await this.findOne(sedeId, id);
    await this.prisma.documentoVehiculo.create({ data: { vehiculoId: id, tipo: dto.tipo, numero: dto.numero ?? '', vencimiento: new Date(dto.vencimiento), ...(dto.archivoBase64 ? { archivo: Buffer.from(dto.archivoBase64, 'base64'), archivoNombre: dto.archivoNombre ?? 'documento.pdf', archivoMime: dto.archivoMime ?? 'application/pdf' } : {}) } });
    return this.findOne(sedeId, id);
  }
  async renovarDoc(sedeId: string, id: string, docId: string, dto: RenovarDocumentoDto) {
    const doc = await this.prisma.documentoVehiculo.findFirst({ where: { id: docId, vehiculo: { id, sedeId } } });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    await this.prisma.documentoVehiculo.update({ where: { id: docId }, data: mapDoc(dto) });
    return this.findOne(sedeId, id);
  }
  async removeDoc(sedeId: string, id: string, docId: string) {
    const doc = await this.prisma.documentoVehiculo.findFirst({ where: { id: docId, vehiculo: { id, sedeId } } });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    await this.prisma.documentoVehiculo.delete({ where: { id: docId } });
    return this.findOne(sedeId, id);
  }
  async archivo(sedeId: string, docId: string) {
    const doc = await this.prisma.documentoVehiculo.findFirst({ where: { id: docId, vehiculo: { sedeId } } });
    if (!doc || !doc.archivo) throw new NotFoundException('Este documento no tiene archivo adjunto');
    return { nombre: doc.archivoNombre ?? 'documento.pdf', mime: doc.archivoMime ?? 'application/pdf', base64: Buffer.from(doc.archivo).toString('base64') };
  }
}

@Controller('vehiculos')
class VehiculosController {
  constructor(private readonly service: VehiculosService) {}
  @Get() findAll(@CurrentUser() u: JwtUser) { return this.service.findAll(u.sedeId); }
  @Get(':id') findOne(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.findOne(u.sedeId, id); }
  @Post() create(@CurrentUser() u: JwtUser, @Body() dto: CreateVehiculoDto) { return this.service.create(u.sedeId, dto); }
  @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateVehiculoDto) { return this.service.update(u.sedeId, id, dto); }
  @Roles('Administrador') @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.remove(u.sedeId, id); }

  @Post(':id/documentos') addDoc(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: DocumentoDto) { return this.service.addDoc(u.sedeId, id, dto); }
  @Patch(':id/documentos/:docId') renovarDoc(@CurrentUser() u: JwtUser, @Param('id') id: string, @Param('docId') docId: string, @Body() dto: RenovarDocumentoDto) { return this.service.renovarDoc(u.sedeId, id, docId, dto); }
  @Delete(':id/documentos/:docId') removeDoc(@CurrentUser() u: JwtUser, @Param('id') id: string, @Param('docId') docId: string) { return this.service.removeDoc(u.sedeId, id, docId); }
  @Get(':id/documentos/:docId/archivo') archivo(@CurrentUser() u: JwtUser, @Param('docId') docId: string) { return this.service.archivo(u.sedeId, docId); }
}

@Module({ controllers: [VehiculosController], providers: [VehiculosService] })
export class VehiculosModule {}
