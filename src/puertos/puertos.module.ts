import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsNotEmpty, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser, JwtUser } from '../common/decorators';

class CreatePuertoDto {
  @IsString() @IsNotEmpty() nombre: string;
}
class UpdatePuertoDto extends PartialType(CreatePuertoDto) {}

@Injectable()
class PuertosService {
  constructor(private prisma: PrismaService) {}
  findAll(sedeId: string) { return this.prisma.puerto.findMany({ where: { sedeId }, orderBy: { nombre: 'asc' } }); }
  create(sedeId: string, dto: CreatePuertoDto) { return this.prisma.puerto.create({ data: { ...dto, sedeId } }); }
  async update(sedeId: string, id: string, dto: UpdatePuertoDto) {
    const p = await this.prisma.puerto.findFirst({ where: { id, sedeId } });
    if (!p) throw new NotFoundException('Puerto no encontrado');
    return this.prisma.puerto.update({ where: { id }, data: dto });
  }
  async remove(sedeId: string, id: string) {
    const p = await this.prisma.puerto.findFirst({ where: { id, sedeId } });
    if (!p) throw new NotFoundException('Puerto no encontrado');
    return this.prisma.puerto.delete({ where: { id } });
  }
}

@Controller('puertos')
class PuertosController {
  constructor(private readonly service: PuertosService) {}
  @Get() findAll(@CurrentUser() u: JwtUser) { return this.service.findAll(u.sedeId); }
  @Roles('Administrador') @Post() create(@CurrentUser() u: JwtUser, @Body() dto: CreatePuertoDto) { return this.service.create(u.sedeId, dto); }
  @Roles('Administrador') @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdatePuertoDto) { return this.service.update(u.sedeId, id, dto); }
  @Roles('Administrador') @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.remove(u.sedeId, id); }
}

@Module({ controllers: [PuertosController], providers: [PuertosService] })
export class PuertosModule {}
