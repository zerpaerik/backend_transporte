import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

class DocumentoDto {
  @IsString() @IsNotEmpty() tipo: string;
  @IsString() @IsOptional() numero?: string;
  @IsDateString() vencimiento: string;
}

class CreateConductorDto {
  @IsString() @IsNotEmpty() nombre: string;
  @IsString() @IsNotEmpty() licencia: string;
  @IsString() @IsOptional() categoria?: string;
  @IsString() @IsOptional() telefono?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => DocumentoDto) @IsOptional() documentos?: DocumentoDto[];
}
class UpdateConductorDto extends PartialType(CreateConductorDto) {}

function mapDocs(docs?: DocumentoDto[]) {
  return (docs ?? []).map((d) => ({ tipo: d.tipo, numero: d.numero ?? '', vencimiento: new Date(d.vencimiento) }));
}

@Injectable()
class ConductoresService {
  constructor(private prisma: PrismaService) {}
  findAll() { return this.prisma.conductor.findMany({ orderBy: { createdAt: 'desc' }, include: { documentos: true } }); }
  async findOne(id: string) {
    const c = await this.prisma.conductor.findUnique({ where: { id }, include: { documentos: true } });
    if (!c) throw new NotFoundException('Conductor no encontrado');
    return c;
  }
  create(dto: CreateConductorDto) {
    const { documentos, ...rest } = dto;
    return this.prisma.conductor.create({
      data: { ...rest, categoria: rest.categoria ?? '', telefono: rest.telefono ?? '', documentos: { create: mapDocs(documentos) } },
      include: { documentos: true },
    });
  }
  async update(id: string, dto: UpdateConductorDto) {
    await this.findOne(id);
    const { documentos, ...rest } = dto;
    if (documentos) {
      await this.prisma.documentoConductor.deleteMany({ where: { conductorId: id } });
      await this.prisma.documentoConductor.createMany({ data: mapDocs(documentos).map((d) => ({ ...d, conductorId: id })) });
    }
    return this.prisma.conductor.update({ where: { id }, data: rest, include: { documentos: true } });
  }
  async remove(id: string) { await this.findOne(id); return this.prisma.conductor.delete({ where: { id } }); }
}

@Controller('conductores')
class ConductoresController {
  constructor(private readonly service: ConductoresService) {}
  @Get() findAll() { return this.service.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreateConductorDto) { return this.service.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateConductorDto) { return this.service.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}

@Module({ controllers: [ConductoresController], providers: [ConductoresService] })
export class ConductoresModule {}
