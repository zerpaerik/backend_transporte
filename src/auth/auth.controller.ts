import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, CambiarSedeDto } from './dto/login.dto';
import { CurrentUser, JwtUser, Public, Roles } from '../common/decorators';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('me')
  me(@CurrentUser() user: JwtUser) {
    return user;
  }

  @Roles('Administrador', 'Operador', 'Mecánico', 'Conductor')
  @Post('cambiar-sede')
  cambiarSede(@CurrentUser() user: JwtUser, @Body() dto: CambiarSedeDto) {
    return this.auth.cambiarSede(user, dto.sedeId);
  }
}
