import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Role } from 'src/user/entities/user.entity';
import { JwtAuthGuard } from './jwt.guard';

@Injectable()
export class RolesGuard extends JwtAuthGuard {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean {
    // Récupérer les rôles requis (en tenant compte des décorateurs au niveau de la classe et de la méthode)
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si aucun rôle n'est requis, accorder l'accès
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Extraire l'utilisateur du contexte GraphQL
    const ctx = GqlExecutionContext.create(context);
    const { user } = ctx.getContext().req;

    // Vérifier que l'utilisateur existe et possède un rôle valide
    if (!user || !user.role) {
      throw new UnauthorizedException('User or user role is missing.');
    }

    // Vérifier si l'utilisateur possède au moins un rôle requis
    return requiredRoles.some((role) => user.role === role);
  }
}