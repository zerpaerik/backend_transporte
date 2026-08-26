import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Correo inválido' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Debes seleccionar una sede' })
  sedeId: string;
}

export class CambiarSedeDto {
  @IsString()
  @IsNotEmpty({ message: 'Debes seleccionar una sede' })
  sedeId: string;
}
