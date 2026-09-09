import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser, JwtUser } from '../common/decorators';

class CreatePeajeDto {
  @IsString() @IsNotEmpty() destino: string;
  @IsNumber() @Min(0) @IsOptional() ejes?: number;
  @IsNumber() @Min(0) @IsOptional() monto?: number;
}
class UpdatePeajeDto extends PartialType(CreatePeajeDto) {}

@Injectable()
class PeajesService {
  constructor(private prisma: PrismaService) {}
  findAll(sedeId: string) { return this.prisma.peaje.findMany({ where: { sedeId }, orderBy: [{ destino: 'asc' }, { ejes: 'asc' }] }); }
  create(sedeId: string, dto: CreatePeajeDto) { return this.prisma.peaje.create({ data: { destino: dto.destino, ejes: dto.ejes ?? 0, monto: dto.monto ?? 0, sedeId } }); }
  async update(sedeId: string, id: string, dto: UpdatePeajeDto) {
    const p = await this.prisma.peaje.findFirst({ where: { id, sedeId } });
    if (!p) throw new NotFoundException('Peaje no encontrado');
    return this.prisma.peaje.update({ where: { id }, data: dto });
  }
  async remove(sedeId: string, id: string) {
    const p = await this.prisma.peaje.findFirst({ where: { id, sedeId } });
    if (!p) throw new NotFoundException('Peaje no encontrado');
    return this.prisma.peaje.delete({ where: { id } });
  }
}

@Controller('peajes')
class PeajesController {
  constructor(private readonly service: PeajesService) {}
  @Get() findAll(@CurrentUser() u: JwtUser) { return this.service.findAll(u.sedeId); }
  @Roles('Administrador') @Post() create(@CurrentUser() u: JwtUser, @Body() dto: CreatePeajeDto) { return this.service.create(u.sedeId, dto); }
  @Roles('Administrador') @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdatePeajeDto) { return this.service.update(u.sedeId, id, dto); }
  @Roles('Administrador') @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.remove(u.sedeId, id); }
}

@Module({ controllers: [PeajesController], providers: [PeajesService] })
export class PeajesModule {}
