import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../user/user.service';
import { User } from '../user/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly userService: UserService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), 
      ignoreExpiration: false, 
      secretOrKey: process.env.JWT_SECRET || 'your_jwt_secret_key', 
    });
  }

  async validate(payload: any): Promise<User> {
    const user = await this.userService.findByEmail(payload.username);

    if (!user) {
      console.error('User not found for payload:', payload);
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}