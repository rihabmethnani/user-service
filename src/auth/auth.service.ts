import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcryptjs';
import { User } from '../user/entities/user.entity';
import { RabbitMQService } from 'src/RabbitMq/rabbitmq.service';
import { AuthResponse } from './dto/auth-response';
import { Role } from '../user/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private rabbitMQService: RabbitMQService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      return null;
    }

    // Vérifier si le compte est supprimé (soft delete)
    if (user.deletedAt) {
      throw new UnauthorizedException('This account has been deleted.');
    }

    // Vérification spécifique pour les partenaires
    if (user.role === Role.PARTNER && !user.isValid) {
      throw new UnauthorizedException('Partner account not yet validated by admin.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (isPasswordValid) {
      const userObject = user.toObject ? user.toObject() : user;
      const { password, ...result } = userObject;
      return result as User;
    }

    return null;
  }

  async login(user: any): Promise<AuthResponse> {
    // Vérification supplémentaire au moment du login (au cas où)
    if (user.role === Role.PARTNER && !user.isValid) {
      throw new UnauthorizedException('Partner account not yet validated by admin.');
    }

    const payload = { 
      username: user.email, 
      sub: user._id, 
      role: user.role,
      isValid: user.role === Role.PARTNER ? user.isValid : undefined
    };
  
    // Publier un événement "USER_LOGGED_IN"
    await this.rabbitMQService.publishEvent('USER_LOGGED_IN', {
      userId: user._id,
      email: user.email,
      role: user.role,
      isValid: user.role === Role.PARTNER ? user.isValid : undefined,
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

      // Vérification pour les partenaires lors de la validation du token
      if (user.role === Role.PARTNER && !user.isValid) {
        throw new UnauthorizedException('Partner account not yet validated by admin.');
      }

      return { isValid: true, user };
    } catch (error) {
      console.error('Error validating token:', error);
      return { isValid: false };
    }
  }

  async loadMe(token: string): Promise<User> {
    try {
      const payload: any = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET!,
      });
  
      const user = await this.userService.getById(payload.sub);
  
      if (!user) {
        throw new UnauthorizedException('User not found.');
      }
  
      if (user.role === Role.PARTNER && !user.isValid) {
        throw new UnauthorizedException('Partner account not yet validated by admin.');
      }
  
      const { password, ...userWithoutPassword } = user.toObject ? user.toObject() : user;
      return userWithoutPassword as User;
    } catch (error) {
      console.error('Error loading user from token:', error);
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }
  
}