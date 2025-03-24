// src/auth/auth.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserModule } from 'src/user/user.module';
import { AuthResolver } from './auth.resolver';
import { JwtAuthGuard } from './jwt.guard';
import { RabbitMQService } from 'src/RabbitMq/rabbitmq.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    JwtModule.register({
      
        secret: process.env.JWT_SECRET || 'your_jwt_secret_key', // Utiliser le secret depuis les variables d'environnement ou une valeur par défaut
        signOptions: { expiresIn: '1h' },
    
    }),
    forwardRef(() => UserModule),
  ],
  providers: [AuthService, JwtStrategy, RolesGuard, AuthResolver, JwtService, JwtAuthGuard,RabbitMQService],
  exports: [AuthService, JwtService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}