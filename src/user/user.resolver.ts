import { Resolver, Mutation, Args, Context, Query } from '@nestjs/graphql';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { NotFoundException, UseGuards, ForbiddenException } from '@nestjs/common';
import { Role } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser } from 'src/decoraters/current-user.decorator';

@Resolver(() => User)
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  // Mutation pour créer un administrateur (seul un admin peut créer un admin)
  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN) // Seul un ADMIN peut créer un autre ADMIN
  async createAdmin(
    @Args('createUserDto') createUserDto: CreateUserDto,
    @Context() context,
  ): Promise<User> {
    const authenticatedUser = context.req.user;

    // Vérifier que l'utilisateur authentifié est un ADMIN
    if (authenticatedUser.role !== Role.ADMIN) {
      throw new ForbiddenException('Only ADMIN can create another ADMIN.');
    }

    // Forcer le rôle ADMIN
    createUserDto.role = Role.ADMIN;

    return this.userService.create(createUserDto);
  }

  // Mutation pour créer un partenaire (seul un admin peut créer un partenaire)
  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN) // Seul un ADMIN peut créer un PARTNER
  async createPartner(
    @Args('createUserDto') createUserDto: CreateUserDto,
    @Context() context,
  ): Promise<User> {
    const authenticatedUser = context.req.user;

    // Vérifier que l'utilisateur authentifié est un ADMIN
    if (authenticatedUser.role !== Role.ADMIN) {
      throw new ForbiddenException('Only ADMIN can create a PARTNER.');
    }

    // Forcer le rôle PARTNER
    createUserDto.role = Role.PARTNER;

    return this.userService.create(createUserDto);
  }

  // Mutation pour créer un client (un admin ou un partenaire peut créer un client)
  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.PARTNER) // ADMIN et PARTNER peuvent créer un CLIENT
  async createClient(
    @Args('createUserDto') createUserDto: CreateUserDto,
    @Context() context,
  ): Promise<User> {
    const authenticatedUser = context.req.user;

    // Vérifier que l'utilisateur authentifié est un ADMIN ou un PARTNER
    if (
      authenticatedUser.role !== Role.ADMIN &&
      authenticatedUser.role !== Role.PARTNER
    ) {
      throw new ForbiddenException('Only ADMIN or PARTNER can create a CLIENT.');
    }

    // Forcer le rôle CLIENT
    createUserDto.role = Role.CLIENT;

    return this.userService.create(createUserDto);
  }

  // Mutation pour créer un chauffeur (seul un admin peut créer un chauffeur)
  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN) // Seul un ADMIN peut créer un DRIVER
  async createDriver(
    @Args('createUserDto') createUserDto: CreateUserDto,
    @Context() context,
  ): Promise<User> {
    const authenticatedUser = context.req.user;

    // Vérifier que l'utilisateur authentifié est un ADMIN
    if (authenticatedUser.role !== Role.ADMIN) {
      throw new ForbiddenException('Only ADMIN can create a DRIVER.');
    }

    // Forcer le rôle DRIVER
    createUserDto.role = Role.DRIVER;

    return this.userService.create(createUserDto);
  }

  // Query pour récupérer un utilisateur par email (seul un admin peut accéder)
  @Query(() => User)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getUserByEmail(@Args('email') email: string): Promise<User> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found.`);
    }
    return user;
  }


  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updateUser(
    @Args('id') id: string,
    @Args('updateUserDto') updateUserDto: UpdateUserDto,
    @Context() context,
  ): Promise<User> {
    const authenticatedUser = context.req.user;
    const userToUpdate = await this.userService.getById(id);
  
    if (!userToUpdate) {
      throw new NotFoundException(`User with ID ${id} not found or has been deleted.`);
    }
  
    // Admin peut mettre à jour tout le monde
    if (authenticatedUser.role === Role.ADMIN) {
      const updatedUser = await this.userService.update(id, updateUserDto);
      if (!updatedUser) {
        throw new NotFoundException(`User with ID ${id} not found or has been deleted.`);
      }
      return updatedUser;
    }
  
    // Partenaire peut mettre à jour les clients
    if (
      authenticatedUser.role === Role.PARTNER &&
      userToUpdate.role === Role.CLIENT
    ) {
      const updatedUser = await this.userService.update(id, updateUserDto);
      if (!updatedUser) {
        throw new NotFoundException(`User with ID ${id} not found or has been deleted.`);
      }
      return updatedUser;
    }
  
    // Client peut se mettre à jour lui-même
    if (
      authenticatedUser.role === Role.CLIENT &&
      authenticatedUser._id.toString() === id
    ) {
      const updatedUser = await this.userService.update(id, updateUserDto);
      if (!updatedUser) {
        throw new NotFoundException(`User with ID ${id} not found or has been deleted.`);
      }
      return updatedUser;
    }
  
    throw new ForbiddenException('You are not authorized to update this user.');
  }

  // Mutation pour supprimer un utilisateur (soft remove)
  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async softRemoveUser(
    @Args('id') id: string,
    @Context() context,
  ): Promise<User> {
    const authenticatedUser = context.req.user;
    const userToDelete = await this.userService.getById(id);

    if (!userToDelete) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }

    // Admin peut supprimer tout le monde
    if (authenticatedUser.role === Role.ADMIN) {
      const deletedUser = await this.userService.softRemove(id);
      if (!deletedUser) {
        throw new NotFoundException(`User with ID ${id} not found.`);
      }
      return deletedUser;
    }

    // Partenaire peut supprimer les clients
    if (
      authenticatedUser.role === Role.PARTNER &&
      userToDelete.role === Role.CLIENT
    ) {
      const deletedUser = await this.userService.softRemove(id);
      if (!deletedUser) {
        throw new NotFoundException(`User with ID ${id} not found.`);
      }
      return deletedUser;
    }

    throw new ForbiddenException('You are not authorized to delete this user.');
  }


  @Query(() => [User])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.PARTNER) 
  async getAllUsers(): Promise<User[]> {
    return this.userService.getAll();
  }

  @Query(() => User)
  @UseGuards(JwtAuthGuard)
  async getUserById(@Args('id') id: string): Promise<User> {
    const user = await this.userService.getById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }
    return user;
  }

  @Query(() => [User])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN) 
  async getUsersByRole(@Args('role') role: Role): Promise<User[]> {
    return this.userService.getByRole(role);
  }


  @Query(() => [User])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.PARTNER) 
  async getAllClients(): Promise<User[]> {
    return this.userService.getByRole(Role.CLIENT);
  }

  @Query(() => User)
@UseGuards(JwtAuthGuard) // Garde pour valider le token JWT
async validateToken(@CurrentUser() user: any): Promise<any> {
  return user; // Retourne les informations de l'utilisateur connecté
}

}