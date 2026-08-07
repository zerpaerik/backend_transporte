import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, IsNotEmpty, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, JwtUser } from '../common/decorators';

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
  findAll(sedeId: string) { return this.prisma.ordenTrabajo.findMany({ where: { sedeId }, orderBy: { fecha: 'desc' } }); }
  async findOne(sedeId: string, id: string) {
    const o = await this.prisma.ordenTrabajo.findFirst({ where: { id, sedeId } });
    if (!o) throw new NotFoundException('Orden no encontrada');
    return o;
  }
  create(sedeId: string, dto: CreateOrdenDto) { return this.prisma.ordenTrabajo.create({ data: { ...toData(dto), sedeId } as any }); }
  async update(sedeId: string, id: string, dto: UpdateOrdenDto) { await this.findOne(sedeId, id); return this.prisma.ordenTrabajo.update({ where: { id }, data: toData(dto) }); }
  async remove(sedeId: string, id: string) { await this.findOne(sedeId, id); return this.prisma.ordenTrabajo.delete({ where: { id } }); }
}

@Controller('ordenes')
class OrdenesController {
  constructor(private readonly service: OrdenesService) {}
  @Get() findAll(@CurrentUser() u: JwtUser) { return this.service.findAll(u.sedeId); }
  @Get(':id') findOne(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.findOne(u.sedeId, id); }
  @Post() create(@CurrentUser() u: JwtUser, @Body() dto: CreateOrdenDto) { return this.service.create(u.sedeId, dto); }
  @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateOrdenDto) { return this.service.update(u.sedeId, id, dto); }
  @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.remove(u.sedeId, id); }
}

@Module({ controllers: [OrdenesController], providers: [OrdenesService] })
export class OrdenesModule {}
