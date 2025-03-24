import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Role } from 'src/user/entities/user.entity';
import { JwtAuthGuard } from './jwt.guard';

@Injectable()
export class RolesGuard extends JwtAuthGuard {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const requiredRoles = this.reflector.get<Role[]>('roles', context.getHandler());
    if (!requiredRoles) {
      return true; // Si aucun rôle n'est requis, autoriser l'accès
    }

    const ctx = GqlExecutionContext.create(context);
    const { user } = ctx.getContext().req; // Accède à l'utilisateur via `req`
    return requiredRoles.some((role) => user.role === role); // Vérifie si l'utilisateur a le rôle requis
  }
}