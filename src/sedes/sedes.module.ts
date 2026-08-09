import { Module, Injectable, Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/decorators';

@Injectable()
class SedesService {
  constructor(private prisma: PrismaService) {}
  findActivas() {
    return this.prisma.sede.findMany({
      where: { activa: true },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      select: { id: true, codigo: true, nombre: true, ruc: true },
    });
  }
}

@Controller('sedes')
class SedesController {
  constructor(private readonly service: SedesService) {}
  @Public()
  @Get()
  findAll() {
    return this.service.findActivas();
  }
}

@Module({ controllers: [SedesController], providers: [SedesService] })
export class SedesModule {}
