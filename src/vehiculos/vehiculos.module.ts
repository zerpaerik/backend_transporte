import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsInt, IsOptional, IsString, Min, IsNotEmpty } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators';

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

@Injectable()
class VehiculosService {
  constructor(private prisma: PrismaService) {}
  findAll() { return this.prisma.vehiculo.findMany({ orderBy: { createdAt: 'desc' } }); }
  async findOne(id: string) {
    const v = await this.prisma.vehiculo.findUnique({ where: { id } });
    if (!v) throw new NotFoundException('Vehículo no encontrado');
    return v;
  }
  create(dto: CreateVehiculoDto) { return this.prisma.vehiculo.create({ data: dto as any }); }
  async update(id: string, dto: UpdateVehiculoDto) { await this.findOne(id); return this.prisma.vehiculo.update({ where: { id }, data: dto }); }
  async remove(id: string) { await this.findOne(id); return this.prisma.vehiculo.delete({ where: { id } }); }
}

@Controller('vehiculos')
class VehiculosController {
  constructor(private readonly service: VehiculosService) {}
  @Get() findAll() { return this.service.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreateVehiculoDto) { return this.service.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateVehiculoDto) { return this.service.update(id, dto); }
  @Roles('Administrador') @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}

@Module({ controllers: [VehiculosController], providers: [VehiculosService] })
export class VehiculosModule {}
