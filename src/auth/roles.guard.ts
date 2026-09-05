import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, Rol } from '../common/decorators';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Rol[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const { user } = context.switchToHttp().getRequest();

    // El rol Conductor es de solo lectura y muy acotado: se le niega todo salvo
    // las rutas que lo habilitan explícitamente (ver/descargar flota y conductores).
    if (user?.rol === 'Conductor') {
      if (required && required.includes('Conductor')) return true;
      throw new ForbiddenException('No tienes permisos para este módulo.');
    }

    // El rol Contable solo entra al gestor de archivos (con todo permitido allí).
    if (user?.rol === 'Contable') {
      if (required && required.includes('Contable')) return true;
      throw new ForbiddenException('No tienes permisos para este módulo.');
    }

    if (!required || required.length === 0) return true;
    if (user && required.includes(user.rol)) return true;
    throw new ForbiddenException('No tienes permisos para este módulo.');
  }
}
