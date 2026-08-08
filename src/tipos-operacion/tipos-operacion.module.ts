import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser, JwtUser } from '../common/decorators';

class CreateTipoDto {
  @IsString() @IsNotEmpty() nombre: string;
  @IsBoolean() @IsOptional() activo?: boolean;
}
class UpdateTipoDto extends PartialType(CreateTipoDto) {}

@Injectable()
class TiposOperacionService {
  constructor(private prisma: PrismaService) {}
  findAll(sedeId: string) { return this.prisma.tipoOperacion.findMany({ where: { sedeId }, orderBy: { nombre: 'asc' } }); }
  create(sedeId: string, dto: CreateTipoDto) { return this.prisma.tipoOperacion.create({ data: { ...dto, sedeId } }); }
  async update(sedeId: string, id: string, dto: UpdateTipoDto) {
    const t = await this.prisma.tipoOperacion.findFirst({ where: { id, sedeId } });
    if (!t) throw new NotFoundException('Tipo de operación no encontrado');
    return this.prisma.tipoOperacion.update({ where: { id }, data: dto });
  }
  async remove(sedeId: string, id: string) {
    const t = await this.prisma.tipoOperacion.findFirst({ where: { id, sedeId } });
    if (!t) throw new NotFoundException('Tipo de operación no encontrado');
    return this.prisma.tipoOperacion.delete({ where: { id } });
  }
}

@Controller('tipos-operacion')
class TiposOperacionController {
  constructor(private readonly service: TiposOperacionService) {}
  @Get() findAll(@CurrentUser() u: JwtUser) { return this.service.findAll(u.sedeId); }
  @Roles('Administrador') @Post() create(@CurrentUser() u: JwtUser, @Body() dto: CreateTipoDto) { return this.service.create(u.sedeId, dto); }
  @Roles('Administrador') @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateTipoDto) { return this.service.update(u.sedeId, id, dto); }
  @Roles('Administrador') @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.remove(u.sedeId, id); }
}

@Module({ controllers: [TiposOperacionController], providers: [TiposOperacionService] })
export class TiposOperacionModule {}
