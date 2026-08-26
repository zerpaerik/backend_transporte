import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength, IsNotEmpty } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators';

class CreateUsuarioDto {
  @IsString() @IsNotEmpty() nombre: string;
  @IsEmail() email: string;
  @IsString() @MinLength(4) password: string;
  @IsIn(['Administrador', 'Operador', 'Mecánico', 'Conductor']) @IsOptional() rol?: string;
  @IsBoolean() @IsOptional() activo?: boolean;
}
class UpdateUsuarioDto extends PartialType(CreateUsuarioDto) {}

const SAFE = { id: true, nombre: true, email: true, rol: true, activo: true, createdAt: true, updatedAt: true };

@Injectable()
class UsuariosService {
  constructor(private prisma: PrismaService) {}
  findAll() { return this.prisma.usuario.findMany({ orderBy: { createdAt: 'desc' }, select: SAFE }); }
  async findOne(id: string) {
    const u = await this.prisma.usuario.findUnique({ where: { id }, select: SAFE });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    return u;
  }
  async create(dto: CreateUsuarioDto) {
    const password = await bcrypt.hash(dto.password, 10);
    return this.prisma.usuario.create({ data: { ...dto, email: dto.email.toLowerCase(), password }, select: SAFE });
  }
  async update(id: string, dto: UpdateUsuarioDto) {
    await this.findOne(id);
    const data: any = { ...dto };
    if (dto.email) data.email = dto.email.toLowerCase();
    if (dto.password) data.password = await bcrypt.hash(dto.password, 10);
    return this.prisma.usuario.update({ where: { id }, data, select: SAFE });
  }
  async remove(id: string) { await this.findOne(id); await this.prisma.usuario.delete({ where: { id } }); return { ok: true }; }
}

@Roles('Administrador')
@Controller('usuarios')
class UsuariosController {
  constructor(private readonly service: UsuariosService) {}
  @Get() findAll() { return this.service.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreateUsuarioDto) { return this.service.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateUsuarioDto) { return this.service.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}

@Module({ controllers: [UsuariosController], providers: [UsuariosService] })
export class UsuariosModule {}
