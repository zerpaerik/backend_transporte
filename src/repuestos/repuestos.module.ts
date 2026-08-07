import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, IsNotEmpty, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, JwtUser } from '../common/decorators';

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
  findAll(sedeId: string) { return this.prisma.repuesto.findMany({ where: { sedeId }, orderBy: { fecha: 'desc' } }); }
  async findOne(sedeId: string, id: string) {
    const r = await this.prisma.repuesto.findFirst({ where: { id, sedeId } });
    if (!r) throw new NotFoundException('Repuesto no encontrado');
    return r;
  }
  create(sedeId: string, dto: CreateRepuestoDto) { return this.prisma.repuesto.create({ data: { ...toData(dto), sedeId } as any }); }
  async update(sedeId: string, id: string, dto: UpdateRepuestoDto) { await this.findOne(sedeId, id); return this.prisma.repuesto.update({ where: { id }, data: toData(dto) }); }
  async remove(sedeId: string, id: string) { await this.findOne(sedeId, id); return this.prisma.repuesto.delete({ where: { id } }); }
}

@Controller('repuestos')
class RepuestosController {
  constructor(private readonly service: RepuestosService) {}
  @Get() findAll(@CurrentUser() u: JwtUser) { return this.service.findAll(u.sedeId); }
  @Get(':id') findOne(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.findOne(u.sedeId, id); }
  @Post() create(@CurrentUser() u: JwtUser, @Body() dto: CreateRepuestoDto) { return this.service.create(u.sedeId, dto); }
  @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateRepuestoDto) { return this.service.update(u.sedeId, id, dto); }
  @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.remove(u.sedeId, id); }
}

@Module({ controllers: [RepuestosController], providers: [RepuestosService] })
export class RepuestosModule {}
