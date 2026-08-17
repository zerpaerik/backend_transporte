import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, JwtUser } from '../common/decorators';

class DocumentoDto {
  @IsString() @IsNotEmpty() tipo: string;
  @IsString() @IsOptional() numero?: string;
  @IsDateString() vencimiento: string;
  @IsString() @IsOptional() archivoBase64?: string;
  @IsString() @IsOptional() archivoNombre?: string;
  @IsString() @IsOptional() archivoMime?: string;
}
class RenovarDocumentoDto extends PartialType(DocumentoDto) {}

class CreateConductorDto {
  @IsString() @IsNotEmpty() nombre: string;
  @IsString() @IsNotEmpty() licencia: string;
  @IsString() @IsOptional() categoria?: string;
  @IsString() @IsOptional() telefono?: string;
  @IsNumber() @Min(0) @IsOptional() descuentoMensual?: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => DocumentoDto) @IsOptional() documentos?: DocumentoDto[];
}
class UpdateConductorDto extends PartialType(CreateConductorDto) {}

// Campos que se devuelven de cada documento (SIN el binario del archivo).
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
class ConductoresService {
  constructor(private prisma: PrismaService) {}

  findAll(sedeId: string) {
    return this.prisma.conductor.findMany({ where: { sedeId }, orderBy: { createdAt: 'desc' }, include: { documentos: { select: DOC_SELECT } } });
  }
  async findOne(sedeId: string, id: string) {
    const c = await this.prisma.conductor.findFirst({ where: { id, sedeId }, include: { documentos: { select: DOC_SELECT } } });
    if (!c) throw new NotFoundException('Conductor no encontrado');
    return c;
  }
  create(sedeId: string, dto: CreateConductorDto) {
    const { documentos, ...rest } = dto;
    return this.prisma.conductor.create({
      data: { ...rest, sedeId, categoria: rest.categoria ?? '', telefono: rest.telefono ?? '', documentos: { create: (documentos ?? []).map((d) => ({ tipo: d.tipo, numero: d.numero ?? '', vencimiento: new Date(d.vencimiento), ...(d.archivoBase64 ? { archivo: Buffer.from(d.archivoBase64, 'base64'), archivoNombre: d.archivoNombre ?? 'documento.pdf', archivoMime: d.archivoMime ?? 'application/pdf' } : {}) })) } },
      include: { documentos: { select: DOC_SELECT } },
    });
  }
  async update(sedeId: string, id: string, dto: UpdateConductorDto) {
    await this.findOne(sedeId, id);
    const { documentos, ...rest } = dto;
    return this.prisma.conductor.update({ where: { id }, data: rest, include: { documentos: { select: DOC_SELECT } } });
  }
  async remove(sedeId: string, id: string) { await this.findOne(sedeId, id); return this.prisma.conductor.delete({ where: { id } }); }

  // --- Documentos ---
  async addDoc(sedeId: string, id: string, dto: DocumentoDto) {
    await this.findOne(sedeId, id);
    await this.prisma.documentoConductor.create({ data: { conductorId: id, tipo: dto.tipo, numero: dto.numero ?? '', vencimiento: new Date(dto.vencimiento), ...(dto.archivoBase64 ? { archivo: Buffer.from(dto.archivoBase64, 'base64'), archivoNombre: dto.archivoNombre ?? 'documento.pdf', archivoMime: dto.archivoMime ?? 'application/pdf' } : {}) } });
    return this.findOne(sedeId, id);
  }
  async renovarDoc(sedeId: string, id: string, docId: string, dto: RenovarDocumentoDto) {
    const doc = await this.prisma.documentoConductor.findFirst({ where: { id: docId, conductor: { id, sedeId } } });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    await this.prisma.documentoConductor.update({ where: { id: docId }, data: mapDoc(dto) });
    return this.findOne(sedeId, id);
  }
  async removeDoc(sedeId: string, id: string, docId: string) {
    const doc = await this.prisma.documentoConductor.findFirst({ where: { id: docId, conductor: { id, sedeId } } });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    await this.prisma.documentoConductor.delete({ where: { id: docId } });
    return this.findOne(sedeId, id);
  }
  async archivo(sedeId: string, docId: string) {
    const doc = await this.prisma.documentoConductor.findFirst({ where: { id: docId, conductor: { sedeId } } });
    if (!doc || !doc.archivo) throw new NotFoundException('Este documento no tiene archivo adjunto');
    return { nombre: doc.archivoNombre ?? 'documento.pdf', mime: doc.archivoMime ?? 'application/pdf', base64: Buffer.from(doc.archivo).toString('base64') };
  }
}

@Controller('conductores')
class ConductoresController {
  constructor(private readonly service: ConductoresService) {}
  @Get() findAll(@CurrentUser() u: JwtUser) { return this.service.findAll(u.sedeId); }
  @Get(':id') findOne(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.findOne(u.sedeId, id); }
  @Post() create(@CurrentUser() u: JwtUser, @Body() dto: CreateConductorDto) { return this.service.create(u.sedeId, dto); }
  @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateConductorDto) { return this.service.update(u.sedeId, id, dto); }
  @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.remove(u.sedeId, id); }

  @Post(':id/documentos') addDoc(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: DocumentoDto) { return this.service.addDoc(u.sedeId, id, dto); }
  @Patch(':id/documentos/:docId') renovarDoc(@CurrentUser() u: JwtUser, @Param('id') id: string, @Param('docId') docId: string, @Body() dto: RenovarDocumentoDto) { return this.service.renovarDoc(u.sedeId, id, docId, dto); }
  @Delete(':id/documentos/:docId') removeDoc(@CurrentUser() u: JwtUser, @Param('id') id: string, @Param('docId') docId: string) { return this.service.removeDoc(u.sedeId, id, docId); }
  @Get(':id/documentos/:docId/archivo') archivo(@CurrentUser() u: JwtUser, @Param('docId') docId: string) { return this.service.archivo(u.sedeId, docId); }
}

@Module({ controllers: [ConductoresController], providers: [ConductoresService] })
export class ConductoresModule {}
