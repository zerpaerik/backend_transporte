import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, IsNotEmpty, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

class CreateRepuestoDto {
  @IsString() @IsNotEmpty() nombre: string;
  @IsString() @IsOptional() categoria?: string;
  @IsIn(['Original', 'Alternativo', 'Remanufacturado']) calidad: string;
  @IsInt() @Min(1) @IsOptional() cantidad?: number;
  @IsString() @IsOptional() garantia?: string;
  @IsString() @IsOptional() proveedor?: string;
  @IsNumber() @Min(0) @IsOptional() costo?: number;
  @IsDateString() fecha: string;
}
class UpdateRepuestoDto extends PartialType(CreateRepuestoDto) {}

function toData(dto: Partial<CreateRepuestoDto>) {
  const { fecha, ...rest } = dto;
  return { ...rest, ...(fecha ? { fecha: new Date(fecha) } : {}) };
}

@Injectable()
class RepuestosService {
  constructor(private prisma: PrismaService) {}
  findAll() { return this.prisma.repuesto.findMany({ orderBy: { fecha: 'desc' } }); }
  async findOne(id: string) {
    const r = await this.prisma.repuesto.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Repuesto no encontrado');
    return r;
  }
  create(dto: CreateRepuestoDto) { return this.prisma.repuesto.create({ data: toData(dto) as any }); }
  async update(id: string, dto: UpdateRepuestoDto) { await this.findOne(id); return this.prisma.repuesto.update({ where: { id }, data: toData(dto) }); }
  async remove(id: string) { await this.findOne(id); return this.prisma.repuesto.delete({ where: { id } }); }
}

@Controller('repuestos')
class RepuestosController {
  constructor(private readonly service: RepuestosService) {}
  @Get() findAll() { return this.service.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreateRepuestoDto) { return this.service.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateRepuestoDto) { return this.service.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}

@Module({ controllers: [RepuestosController], providers: [RepuestosService] })
export class RepuestosModule {}
