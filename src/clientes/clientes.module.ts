import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser, JwtUser } from '../common/decorators';

class CreateClienteDto {
  @IsString() @IsNotEmpty() nombre: string;
  @IsString() @IsOptional() ruc?: string;
}
class UpdateClienteDto extends PartialType(CreateClienteDto) {}

@Injectable()
class ClientesService {
  constructor(private prisma: PrismaService) {}
  findAll(sedeId: string) { return this.prisma.cliente.findMany({ where: { sedeId }, orderBy: { nombre: 'asc' } }); }
  create(sedeId: string, dto: CreateClienteDto) { return this.prisma.cliente.create({ data: { ...dto, sedeId } }); }
  async update(sedeId: string, id: string, dto: UpdateClienteDto) {
    const c = await this.prisma.cliente.findFirst({ where: { id, sedeId } });
    if (!c) throw new NotFoundException('Cliente no encontrado');
    return this.prisma.cliente.update({ where: { id }, data: dto });
  }
  async remove(sedeId: string, id: string) {
    const c = await this.prisma.cliente.findFirst({ where: { id, sedeId } });
    if (!c) throw new NotFoundException('Cliente no encontrado');
    return this.prisma.cliente.delete({ where: { id } });
  }
}

@Controller('clientes')
class ClientesController {
  constructor(private readonly service: ClientesService) {}
  @Get() findAll(@CurrentUser() u: JwtUser) { return this.service.findAll(u.sedeId); }
  @Roles('Administrador') @Post() create(@CurrentUser() u: JwtUser, @Body() dto: CreateClienteDto) { return this.service.create(u.sedeId, dto); }
  @Roles('Administrador') @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateClienteDto) { return this.service.update(u.sedeId, id, dto); }
  @Roles('Administrador') @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.remove(u.sedeId, id); }
}

@Module({ controllers: [ClientesController], providers: [ClientesService] })
export class ClientesModule {}
