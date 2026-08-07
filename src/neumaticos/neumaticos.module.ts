import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsNotEmpty, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, JwtUser } from '../common/decorators';

class CreateNeumaticoDto {
  @IsString() @IsNotEmpty() placa: string;
  @IsString() @IsNotEmpty() posicion: string;
  @IsString() @IsNotEmpty() marca: string;
  @IsInt() @Min(0) @IsOptional() kmInstalacion?: number;
  @IsInt() @Min(0) @IsOptional() kmActual?: number;
  @IsNumber() @Min(0) @IsOptional() costo?: number;
  @IsString() @IsOptional() tienda?: string;
  @IsIn(['Nuevo', 'En uso', 'Para rotar', 'Reencauche', 'Descartado']) @IsOptional() estado?: string;
}
class UpdateNeumaticoDto extends PartialType(CreateNeumaticoDto) {}

@Injectable()
class NeumaticosService {
  constructor(private prisma: PrismaService) {}
  findAll(sedeId: string) { return this.prisma.neumatico.findMany({ where: { sedeId }, orderBy: { createdAt: 'desc' } }); }
  async findOne(sedeId: string, id: string) {
    const n = await this.prisma.neumatico.findFirst({ where: { id, sedeId } });
    if (!n) throw new NotFoundException('Neumático no encontrado');
    return n;
  }
  create(sedeId: string, dto: CreateNeumaticoDto) { return this.prisma.neumatico.create({ data: { ...dto, sedeId } as any }); }
  async update(sedeId: string, id: string, dto: UpdateNeumaticoDto) { await this.findOne(sedeId, id); return this.prisma.neumatico.update({ where: { id }, data: dto }); }
  async remove(sedeId: string, id: string) { await this.findOne(sedeId, id); return this.prisma.neumatico.delete({ where: { id } }); }
}

@Controller('neumaticos')
class NeumaticosController {
  constructor(private readonly service: NeumaticosService) {}
  @Get() findAll(@CurrentUser() u: JwtUser) { return this.service.findAll(u.sedeId); }
  @Get(':id') findOne(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.findOne(u.sedeId, id); }
  @Post() create(@CurrentUser() u: JwtUser, @Body() dto: CreateNeumaticoDto) { return this.service.create(u.sedeId, dto); }
  @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateNeumaticoDto) { return this.service.update(u.sedeId, id, dto); }
  @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.remove(u.sedeId, id); }
}

@Module({ controllers: [NeumaticosController], providers: [NeumaticosService] })
export class NeumaticosModule {}
