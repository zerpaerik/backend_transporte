import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser, JwtUser } from '../common/decorators';

class CreateProveedorDto {
  @IsString() @IsNotEmpty() razonSocial: string;
  @IsString() @IsOptional() ruc?: string;
  @IsString() @IsOptional() direccion?: string;
  @IsString() @IsOptional() contacto?: string;
  @IsString() @IsOptional() telefono?: string;
}
class UpdateProveedorDto extends PartialType(CreateProveedorDto) {}

@Injectable()
class ProveedoresService {
  constructor(private prisma: PrismaService) {}
  findAll(sedeId: string) { return this.prisma.proveedor.findMany({ where: { sedeId }, orderBy: { razonSocial: 'asc' } }); }
  create(sedeId: string, dto: CreateProveedorDto) { return this.prisma.proveedor.create({ data: { ...dto, sedeId } }); }
  async update(sedeId: string, id: string, dto: UpdateProveedorDto) {
    const p = await this.prisma.proveedor.findFirst({ where: { id, sedeId } });
    if (!p) throw new NotFoundException('Proveedor no encontrado');
    return this.prisma.proveedor.update({ where: { id }, data: dto });
  }
  async remove(sedeId: string, id: string) {
    const p = await this.prisma.proveedor.findFirst({ where: { id, sedeId } });
    if (!p) throw new NotFoundException('Proveedor no encontrado');
    return this.prisma.proveedor.delete({ where: { id } });
  }
}

@Controller('proveedores')
class ProveedoresController {
  constructor(private readonly service: ProveedoresService) {}
  @Get() findAll(@CurrentUser() u: JwtUser) { return this.service.findAll(u.sedeId); }
  @Roles('Administrador') @Post() create(@CurrentUser() u: JwtUser, @Body() dto: CreateProveedorDto) { return this.service.create(u.sedeId, dto); }
  @Roles('Administrador') @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateProveedorDto) { return this.service.update(u.sedeId, id, dto); }
  @Roles('Administrador') @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.remove(u.sedeId, id); }
}

@Module({ controllers: [ProveedoresController], providers: [ProveedoresService] })
export class ProveedoresModule {}
