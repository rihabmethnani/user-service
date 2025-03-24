import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcryptjs';
import { User } from '../user/entities/user.entity';
import { RabbitMQService } from 'src/RabbitMq/rabbitmq.service';
import { AuthResponse } from './dto/auth-response';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private rabbitMQService: RabbitMQService, // Injecter RabbitMQService
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (isPasswordValid) {
      const userObject = user.toObject ? user.toObject() : user;
      const { password, ...result } = userObject; // Exclure le mot de passe
      return result as User;
    }

    return null;
  }

  async login(user: any): Promise<AuthResponse> {
    const payload = { username: user.email, sub: user._id, role: user.role };
  
    // Publier un événement "USER_LOGGED_IN"
    await this.rabbitMQService.publishEvent('USER_LOGGED_IN', {
      userId: user._id,
      email: user.email,
      role: user.role,
      timestamp: new Date(),
    });
  
    return {
      access_token: this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET!,
      }),
    };
  }
  

  async validateToken(token: string): Promise<{ isValid: boolean; user?: any }> {
    try {
      const payload = this.jwtService.decode(token);
      const user = await this.userService.getById(payload.sub);

      if (!user) {
        throw new UnauthorizedException('User not found.');
      }

      return { isValid: true, user };
    } catch (error) {
      console.error('Error validating token:', error);
      return { isValid: false };
    }
  }
}