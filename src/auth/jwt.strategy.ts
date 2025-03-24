import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../user/user.service';
import { User } from '../user/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly userService: UserService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Extraire le token des en-têtes
      ignoreExpiration: false, // Ne pas ignorer l'expiration du token
      secretOrKey: process.env.JWT_SECRET || 'your_jwt_secret_key', // Utiliser la clé secrète JWT
    });
  }

  async validate(payload: any): Promise<User> {
    // Récupérer l'utilisateur par son email (ou son ID, selon le payload)
    const user = await this.userService.findByEmail(payload.username);

    // Si l'utilisateur n'est pas trouvé, lancer une exception
    if (!user) {
      console.error('User not found for payload:', payload);
      throw new UnauthorizedException('User not found');
    }

    // Retourner l'utilisateur trouvé
    return user;
  }
}