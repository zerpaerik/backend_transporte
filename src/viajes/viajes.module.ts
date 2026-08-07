import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsIn, IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

class CreateViajeDto {
  @IsString() @IsNotEmpty() placaTracto: string;
  @IsString() @IsOptional() carreta?: string;
  @IsString() @IsOptional() conductor?: string;
  @IsString() @IsNotEmpty() cliente: string;
  @IsIn(['IMPO', 'EXPO']) operacion: string;
  @IsString() @IsNotEmpty() contenedor: string;
  @IsString() @IsOptional() tamanio?: string;
  @IsString() @IsOptional() tipoCarga?: string;
  @IsString() @IsOptional() horaCita?: string;
  @IsString() @IsOptional() origen?: string;
  @IsString() @IsOptional() destino?: string;
  @IsString() @IsOptional() devolucion?: string;
  @IsDateString() fechaLimite: string;
  @IsIn(['Programado', 'En curso', 'Culminado', 'Devuelto']) @IsOptional() estado?: string;
  @IsString() @IsOptional() nOrden?: string;
  @IsString() @IsOptional() greRemitente?: string;
  @IsString() @IsOptional() greTransporte?: string;
  @IsString() @IsOptional() factura?: string;
}
class UpdateViajeDto extends PartialType(CreateViajeDto) {}

function toData(dto: Partial<CreateViajeDto>) {
  const { fechaLimite, ...rest } = dto;
  return { ...rest, ...(fechaLimite ? { fechaLimite: new Date(fechaLimite) } : {}) };
}

@Injectable()
class ViajesService {
  constructor(private prisma: PrismaService) {}
  findAll() { return this.prisma.viaje.findMany({ orderBy: { createdAt: 'desc' } }); }
  async findOne(id: string) {
    const v = await this.prisma.viaje.findUnique({ where: { id } });
    if (!v) throw new NotFoundException('Viaje no encontrado');
    return v;
  }
  create(dto: CreateViajeDto) { return this.prisma.viaje.create({ data: toData(dto) as any }); }
  async update(id: string, dto: UpdateViajeDto) { await this.findOne(id); return this.prisma.viaje.update({ where: { id }, data: toData(dto) }); }
  async remove(id: string) { await this.findOne(id); return this.prisma.viaje.delete({ where: { id } }); }
}

@Controller('viajes')
class ViajesController {
  constructor(private readonly service: ViajesService) {}
  @Get() findAll() { return this.service.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreateViajeDto) { return this.service.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateViajeDto) { return this.service.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}

@Module({ controllers: [ViajesController], providers: [ViajesService] })
export class ViajesModule {}
