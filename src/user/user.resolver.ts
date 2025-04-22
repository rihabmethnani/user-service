import { Resolver, Mutation, Args, Context, Query } from '@nestjs/graphql';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { NotFoundException, UseGuards, ForbiddenException, UseInterceptors, UploadedFile } from '@nestjs/common';
import { Role } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser } from 'src/decoraters/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';

@Resolver(() => User)
export class UserResolver {
  constructor(private readonly userService: UserService) { }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN) 
  @UseInterceptors(FileInterceptor('image'))
  async createAdmin(
    @Args('createUserDto') createUserDto: CreateUserDto,
    @UploadedFile() file: Express.Multer.File,
    @Context() context,
  ): Promise<User> {
    const authenticatedUser = context.req.user;

    if (authenticatedUser.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER ADMIN can create another ADMIN.');
    }
    if (file) {
      createUserDto.image = `/uploads/${file.filename}`;
    }
    createUserDto.role = Role.ADMIN;

    return this.userService.create(createUserDto);
  }

  @Mutation(() => User)
  @UseInterceptors(FileInterceptor('image'))
  async createPartner(
    @Args('createUserDto') createUserDto: CreateUserDto,
    @UploadedFile() file: Express.Multer.File,
    @Context() context,
  ): Promise<User> {
    const authenticatedUser = context.req.user;
    if (file) {
      createUserDto.image = `/uploads/${file.filename}`;
    }
    createUserDto.role = Role.PARTNER;

    return this.userService.create(createUserDto);
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PARTNER) 
  async createClient(
    @Args('createUserDto') createUserDto: CreateUserDto,
    @Context() context,
  ): Promise<User> {
    const authenticatedUser = context.req.user;

    if (
      authenticatedUser.role !== Role.PARTNER
    ) {
      throw new ForbiddenException('Only PARTNER can create a CLIENT.');
    }

    // Forcer le rôle CLIENT
    createUserDto.role = Role.CLIENT;

    return this.userService.create(createUserDto);
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN) 
  async createDriver(
    @Args('createUserDto') createUserDto: CreateUserDto,
    @Context() context,
  ): Promise<User> {
    const authenticatedUser = context.req.user;

    if (authenticatedUser.role !== Role.ADMIN && authenticatedUser.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN or ADMIN can create a DRIVER.');
    }

    createUserDto.role = Role.DRIVER;

    return this.userService.create(createUserDto);
  }

  @Query(() => User)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async getUserByEmail(@Args('email') email: string): Promise<User> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found.`);
    }
    return user;
  }


  // @Mutation(() => User)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // async updateUser(
  //   @Args('id') id: string,
  //   @Args('updateUserDto') updateUserDto: UpdateUserDto,
  //   @Context() context,
  // ): Promise<User> {
  //   const authenticatedUser = context.req.user;
  //   const userToUpdate = await this.userService.getById(id);

  //   if (!userToUpdate) {
  //     throw new NotFoundException(`User with ID ${id} not found or has been deleted.`);
  //   }

  //   if (authenticatedUser.role === Role.ADMIN && authenticatedUser.role === Role.SUPER_ADMIN) {
  //     const updatedUser = await this.userService.update(id, updateUserDto);
  //     if (!updatedUser) {
  //       throw new NotFoundException(`User with ID ${id} not found or has been deleted.`);
  //     }
  //     return updatedUser;
  //   }

  //   if (
  //     authenticatedUser.role === Role.PARTNER &&
  //     userToUpdate.role === Role.CLIENT
  //   ) {
  //     const updatedUser = await this.userService.update(id, updateUserDto);
  //     if (!updatedUser) {
  //       throw new NotFoundException(`User with ID ${id} not found or has been deleted.`);
  //     }
  //     return updatedUser;
  //   }

  //   if (
  //     authenticatedUser.role === Role.CLIENT &&
  //     authenticatedUser._id.toString() === id
  //   ) {
  //     const updatedUser = await this.userService.update(id, updateUserDto);
  //     if (!updatedUser) {
  //       throw new NotFoundException(`User with ID ${id} not found or has been deleted.`);
  //     }
  //     return updatedUser;
  //   }

  //   throw new ForbiddenException('You are not authorized to update this user.');
  // }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async updateAdmin(
    @Args('id') id: string,
    @Args('updateUserDto') updateUserDto: UpdateUserDto,
    @Context() context,
  ): Promise<User> {
    const authenticatedUser = context.req.user;
    const adminToUpdate = await this.userService.getById(id);
  
    if (!adminToUpdate) {
      throw new NotFoundException(`Admin with ID ${id} not found or has been deleted.`);
    }
  
    if (adminToUpdate.role !== Role.ADMIN) {
      throw new ForbiddenException(`User with ID ${id} is not an ADMIN.`);
    }
  
    const updatedUser = await this.userService.update(id, updateUserDto);
  
    if (!updatedUser) {
      throw new NotFoundException(`Failed to update admin with ID ${id}.`);
    }
  
    return updatedUser; // Ici, TypeScript sait que updatedUser ne sera jamais null
  }

  @Mutation(() => User)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PARTNER)
async updatePartner(
  @Args('id') id: string,
  @Args('updateUserDto') updateUserDto: UpdateUserDto,
  @Context() context,
): Promise<User> {
  const authenticatedUser = context.req.user;
  const partnerToUpdate = await this.userService.getById(id);

  if (!partnerToUpdate) {
    throw new NotFoundException(`Partner with ID ${id} not found or has been deleted.`);
  }

  if (partnerToUpdate.role !== Role.PARTNER) {
    throw new ForbiddenException(`User with ID ${id} is not a PARTNER.`);
  }

  // Un PARTNER ne peut mettre à jour que son propre compte
  if (
    authenticatedUser.role === Role.PARTNER &&
    authenticatedUser._id.toString() !== id
  ) {
    throw new ForbiddenException('You are not authorized to update this partner.');
  }

  const updatedUser = await this.userService.update(id, updateUserDto);

  if (!updatedUser) {
    throw new NotFoundException(`Failed to update partner with ID ${id}.`);
  }

  return updatedUser;
}

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

    if (authenticatedUser.role === Role.SUPER_ADMIN) {
      const deletedUser = await this.userService.softRemove(id);
      if (!deletedUser) {
        throw new NotFoundException(`User with ID ${id} not found.`);
      }
      return deletedUser;
    }

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
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
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
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async getUsersByRole(@Args('role') role: Role): Promise<User[]> {
    return this.userService.getByRole(role);
  }


  @Query(() => [User])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PARTNER)
  async getAllClients(): Promise<User[]> {
    return this.userService.getByRole(Role.CLIENT);
  }

  @Query(() => User)
  @UseGuards(JwtAuthGuard) 
  async validateToken(@CurrentUser() user: any): Promise<any> {
    return user;
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async validatePartner(
    @Args('partnerId') partnerId: string,
    @CurrentUser() admin: User,
  ): Promise<User> {
    const partner = await this.userService.getById(partnerId);
    if (!partner) {
      throw new NotFoundException(`User with ID ${partnerId} not found.`);
    }
    if (partner.role !== Role.PARTNER) {
      throw new ForbiddenException('Only PARTNER users can be validated.');
    }

    const updatedPartner = await this.userService.validatePartner(partnerId);

    return updatedPartner;
  }

}