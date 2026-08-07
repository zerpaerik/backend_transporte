import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, IsNotEmpty, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

class CreateOrdenDto {
  @IsDateString() fecha: string;
  @IsString() @IsNotEmpty() placa: string;
  @IsIn(['Preventivo', 'Correctivo', 'Predictivo']) tipo: string;
  @IsString() @IsNotEmpty() descripcion: string;
  @IsString() @IsOptional() responsable?: string;
  @IsString() @IsOptional() conductor?: string;
  @IsNumber() @Min(0) @IsOptional() costo?: number;
  @IsIn(['Abierta', 'En proceso', 'Cerrada']) @IsOptional() estado?: string;
}
class UpdateOrdenDto extends PartialType(CreateOrdenDto) {}

function toData(dto: Partial<CreateOrdenDto>) {
  const { fecha, ...rest } = dto;
  return { ...rest, ...(fecha ? { fecha: new Date(fecha) } : {}) };
}

@Injectable()
class OrdenesService {
  constructor(private prisma: PrismaService) {}
  findAll() { return this.prisma.ordenTrabajo.findMany({ orderBy: { fecha: 'desc' } }); }
  async findOne(id: string) {
    const o = await this.prisma.ordenTrabajo.findUnique({ where: { id } });
    if (!o) throw new NotFoundException('Orden no encontrada');
    return o;
  }
  create(dto: CreateOrdenDto) { return this.prisma.ordenTrabajo.create({ data: toData(dto) as any }); }
  async update(id: string, dto: UpdateOrdenDto) { await this.findOne(id); return this.prisma.ordenTrabajo.update({ where: { id }, data: toData(dto) }); }
  async remove(id: string) { await this.findOne(id); return this.prisma.ordenTrabajo.delete({ where: { id } }); }
}

@Controller('ordenes')
class OrdenesController {
  constructor(private readonly service: OrdenesService) {}
  @Get() findAll() { return this.service.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreateOrdenDto) { return this.service.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateOrdenDto) { return this.service.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}

@Module({ controllers: [OrdenesController], providers: [OrdenesService] })
export class OrdenesModule {}
