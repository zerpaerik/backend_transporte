import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsInt, IsOptional, IsString, Min, IsNotEmpty } from 'class-validator';
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

@Injectable()
class VehiculosService {
  constructor(private prisma: PrismaService) {}
  findAll(sedeId: string) { return this.prisma.vehiculo.findMany({ where: { sedeId }, orderBy: { createdAt: 'desc' } }); }
  async findOne(sedeId: string, id: string) {
    const v = await this.prisma.vehiculo.findFirst({ where: { id, sedeId } });
    if (!v) throw new NotFoundException('Vehículo no encontrado');
    return v;
  }
  create(sedeId: string, dto: CreateVehiculoDto) { return this.prisma.vehiculo.create({ data: { ...dto, sedeId } as any }); }
  async update(sedeId: string, id: string, dto: UpdateVehiculoDto) { await this.findOne(sedeId, id); return this.prisma.vehiculo.update({ where: { id }, data: dto }); }
  async remove(sedeId: string, id: string) { await this.findOne(sedeId, id); return this.prisma.vehiculo.delete({ where: { id } }); }
}

@Controller('vehiculos')
class VehiculosController {
  constructor(private readonly service: VehiculosService) {}
  @Get() findAll(@CurrentUser() u: JwtUser) { return this.service.findAll(u.sedeId); }
  @Get(':id') findOne(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.findOne(u.sedeId, id); }
  @Post() create(@CurrentUser() u: JwtUser, @Body() dto: CreateVehiculoDto) { return this.service.create(u.sedeId, dto); }
  @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateVehiculoDto) { return this.service.update(u.sedeId, id, dto); }
  @Roles('Administrador') @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.remove(u.sedeId, id); }
}

@Module({ controllers: [VehiculosController], providers: [VehiculosService] })
export class VehiculosModule {}
