import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsNotEmpty, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

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
  findAll() { return this.prisma.neumatico.findMany({ orderBy: { createdAt: 'desc' } }); }
  async findOne(id: string) {
    const n = await this.prisma.neumatico.findUnique({ where: { id } });
    if (!n) throw new NotFoundException('Neumático no encontrado');
    return n;
  }
  create(dto: CreateNeumaticoDto) { return this.prisma.neumatico.create({ data: dto as any }); }
  async update(id: string, dto: UpdateNeumaticoDto) { await this.findOne(id); return this.prisma.neumatico.update({ where: { id }, data: dto }); }
  async remove(id: string) { await this.findOne(id); return this.prisma.neumatico.delete({ where: { id } }); }
}

@Controller('neumaticos')
class NeumaticosController {
  constructor(private readonly service: NeumaticosService) {}
  @Get() findAll() { return this.service.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreateNeumaticoDto) { return this.service.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateNeumaticoDto) { return this.service.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}

@Module({ controllers: [NeumaticosController], providers: [NeumaticosService] })
export class NeumaticosModule {}
