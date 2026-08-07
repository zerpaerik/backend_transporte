import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const sede = await this.prisma.sede.findFirst({ where: { OR: [{ id: dto.sedeId }, { codigo: dto.sedeId }], activa: true } });
    if (!sede) throw new UnauthorizedException('Sede inválida o inactiva.');

    const user = await this.prisma.usuario.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user) throw new UnauthorizedException('Correo o contraseña incorrectos.');
    if (!user.activo) throw new UnauthorizedException('El usuario está inactivo.');

    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) throw new UnauthorizedException('Correo o contraseña incorrectos.');

    const payload = {
      sub: user.id, email: user.email, nombre: user.nombre, rol: user.rol,
      sedeId: sede.id, sedeCodigo: sede.codigo, sedeNombre: sede.nombre,
    };
    const access_token = await this.jwt.signAsync(payload);

    return {
      access_token,
      user: {
        id: user.id, nombre: user.nombre, email: user.email, rol: user.rol, activo: user.activo,
        sede: { id: sede.id, codigo: sede.codigo, nombre: sede.nombre, ruc: sede.ruc },
      },
    };
  }
}
