import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export type Rol = 'Administrador' | 'Operador' | 'Mecánico' | 'Conductor' | 'Contable';
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);

export interface JwtUser {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  sedeId: string;
  sedeCodigo: string;
  sedeNombre: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    return ctx.switchToHttp().getRequest().user;
  },
);
