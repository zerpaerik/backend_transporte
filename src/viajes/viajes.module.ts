import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsIn, IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, JwtUser } from '../common/decorators';

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
  findAll(sedeId: string) { return this.prisma.viaje.findMany({ where: { sedeId }, orderBy: { createdAt: 'desc' } }); }
  async findOne(sedeId: string, id: string) {
    const v = await this.prisma.viaje.findFirst({ where: { id, sedeId } });
    if (!v) throw new NotFoundException('Viaje no encontrado');
    return v;
  }
  create(sedeId: string, dto: CreateViajeDto) { return this.prisma.viaje.create({ data: { ...toData(dto), sedeId } as any }); }
  async update(sedeId: string, id: string, dto: UpdateViajeDto) { await this.findOne(sedeId, id); return this.prisma.viaje.update({ where: { id }, data: toData(dto) }); }
  async remove(sedeId: string, id: string) { await this.findOne(sedeId, id); return this.prisma.viaje.delete({ where: { id } }); }
}

@Controller('viajes')
class ViajesController {
  constructor(private readonly service: ViajesService) {}
  @Get() findAll(@CurrentUser() u: JwtUser) { return this.service.findAll(u.sedeId); }
  @Get(':id') findOne(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.findOne(u.sedeId, id); }
  @Post() create(@CurrentUser() u: JwtUser, @Body() dto: CreateViajeDto) { return this.service.create(u.sedeId, dto); }
  @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateViajeDto) { return this.service.update(u.sedeId, id, dto); }
  @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.remove(u.sedeId, id); }
}

@Module({ controllers: [ViajesController], providers: [ViajesService] })
export class ViajesModule {}
