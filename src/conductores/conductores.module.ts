import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, JwtUser } from '../common/decorators';

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
  findAll(sedeId: string) { return this.prisma.conductor.findMany({ where: { sedeId }, orderBy: { createdAt: 'desc' }, include: { documentos: true } }); }
  async findOne(sedeId: string, id: string) {
    const c = await this.prisma.conductor.findFirst({ where: { id, sedeId }, include: { documentos: true } });
    if (!c) throw new NotFoundException('Conductor no encontrado');
    return c;
  }
  create(sedeId: string, dto: CreateConductorDto) {
    const { documentos, ...rest } = dto;
    return this.prisma.conductor.create({
      data: { ...rest, sedeId, categoria: rest.categoria ?? '', telefono: rest.telefono ?? '', documentos: { create: mapDocs(documentos) } },
      include: { documentos: true },
    });
  }
  async update(sedeId: string, id: string, dto: UpdateConductorDto) {
    await this.findOne(sedeId, id);
    const { documentos, ...rest } = dto;
    if (documentos) {
      await this.prisma.documentoConductor.deleteMany({ where: { conductorId: id } });
      await this.prisma.documentoConductor.createMany({ data: mapDocs(documentos).map((d) => ({ ...d, conductorId: id })) });
    }
    return this.prisma.conductor.update({ where: { id }, data: rest, include: { documentos: true } });
  }
  async remove(sedeId: string, id: string) { await this.findOne(sedeId, id); return this.prisma.conductor.delete({ where: { id } }); }
}

@Controller('conductores')
class ConductoresController {
  constructor(private readonly service: ConductoresService) {}
  @Get() findAll(@CurrentUser() u: JwtUser) { return this.service.findAll(u.sedeId); }
  @Get(':id') findOne(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.findOne(u.sedeId, id); }
  @Post() create(@CurrentUser() u: JwtUser, @Body() dto: CreateConductorDto) { return this.service.create(u.sedeId, dto); }
  @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateConductorDto) { return this.service.update(u.sedeId, id, dto); }
  @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.remove(u.sedeId, id); }
}

@Module({ controllers: [ConductoresController], providers: [ConductoresService] })
export class ConductoresModule {}
