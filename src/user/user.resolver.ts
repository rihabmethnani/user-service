import { Resolver, Mutation, Args, Context, Query } from '@nestjs/graphql';
import { UserService } from './user.service';
import { TunisianRegion, User } from './entities/user.entity';
import { NotFoundException, UseGuards, ForbiddenException, UseInterceptors, UploadedFile, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Role } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser } from 'src/decoraters/current-user.decorator';
import { Types } from 'mongoose';
import { RabbitMQProducer } from 'src/RabbitMq/rabbitmq.service';
import { UserCountStats } from './entities/userCountStats.entity';
import { PartnerCountStats } from './entities/partnerCountsStats.entity';
import { FileUploadInterceptor } from 'src/file-upload/file.interceptor';

@Resolver(() => User)
export class UserResolver {
  constructor(private readonly userService: UserService,
        private rabbitMQProducer: RabbitMQProducer, 
    
  ) { }
  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  // @UseInterceptors(FileUploadInterceptor)
  async createAdmin(
    @Args('createUserDto') createUserDto: CreateUserDto,
    // @UploadedFile() file: Express.Multer.File,
    @Context() context,
  ): Promise<User> {
    // if (file) {
    //   createUserDto.image = `/uploads/${file.filename}`;
    // }
    
    const authenticatedUser = context.req.user;
    if (authenticatedUser.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER ADMIN can create another ADMIN.');
    }
    
    createUserDto.role = Role.ADMIN;
    return this.userService.create(createUserDto);
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN) 
  async createAdminAssistant(
    @Args('createUserDto') createUserDto: CreateUserDto,
    @CurrentUser() currentAdmin: User // Récupère l'admin qui crée le compte
  ): Promise<User> {
    createUserDto.role = Role.ADMIN_ASSISTANT;
    createUserDto.zoneResponsabilite = currentAdmin.zoneResponsabilite as TunisianRegion;

    const newAssistant = await this.userService.create(createUserDto);
  
    // Publier l'événement avec les détails nécessaires
    await this.rabbitMQProducer.publishEvent('ADMIN_ASSISTANT_CREATED', {
      assistantId: newAssistant._id.toString(),
      assistantEmail: newAssistant.email,
      assistantName: newAssistant.name,
      adminCreatorId: currentAdmin._id.toString(),
      adminCreatorEmail: currentAdmin.email,
      password: createUserDto.password
    });
  
    return newAssistant;
  }

  @Mutation(() => User)
  async createPartner(
    @Args('createUserDto') createUserDto: CreateUserDto,
    @Context() context,
  ): Promise<User> {
    const authenticatedUser = context.req.user;
   
    createUserDto.role = Role.PARTNER;
  const newPartner = await this.userService.create(createUserDto)

    // Publier l'événement pour notifier les admins
    await this.rabbitMQProducer.publishEvent("PARTNER_CREATED", {
      userId: newPartner._id.toString(),
      email: newPartner.email,
      name: newPartner.name,
      role: Role.PARTNER,
      createdAt: new Date().toISOString(),
      // Ajouter d'autres informations si nécessaire
      phone: newPartner.phone,
      company: newPartner.companyName, // si vous avez ce champ
    })

    return newPartner
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
    const clientData: CreateUserDto = {
      ...createUserDto,
      role: Role.CLIENT,
      password: '123',
      createdBy:authenticatedUser._id
    };

    return this.userService.create(clientData);
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.ADMIN_ASSISTANT) 
  async createDriver(
    @Args('createUserDto') createUserDto: CreateUserDto,
    @CurrentUser() currentUser: User, // Utilisez CurrentUser au lieu de Context pour plus de clarté
  ): Promise<User> {
    // Vérification des permissions
    if (currentUser.role !== Role.ADMIN && currentUser.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN or ADMIN can create a DRIVER.');
    }
    createUserDto.zoneResponsabilite = currentUser.zoneResponsabilite as TunisianRegion;

  
    createUserDto.role = Role.DRIVER;
    const newDriver = await this.userService.create(createUserDto);
  
   
     
  
      // Optionnel : Publier un événement RabbitMQ si nécessaire
      await this.rabbitMQProducer.publishEvent('DRIVER_CREATED', {
        driverId: newDriver._id.toString(),
        driverEmail: newDriver.email,
        driverName: newDriver.name,
        creatorId: currentUser._id.toString(),
        creatorEmail: currentUser.email,
        password: createUserDto.password,
        createdAt: new Date().toISOString()
      });
  
    
  
    return newDriver;
  }


@Mutation(() => User)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.ADMIN_ASSISTANT)
async updateDriver(
  @Args('id') id: string,
  @Args('updateUserDto') updateUserDto: UpdateUserDto,
  @Context() context,
): Promise<User> {
  const authenticatedUser = context.req.user;
  const userToUpdate = await this.userService.getById(id);
  
  if (!userToUpdate || userToUpdate.role !== Role.DRIVER) {
    throw new NotFoundException(`Driver with ID ${id} not found or has been deleted.`);
  }

  const updatedUser = await this.userService.update(id, updateUserDto);
  
  if (!updatedUser) {
    throw new NotFoundException(`Failed to update driver with ID ${id}.`);
  }  return updatedUser
}

@Mutation(() => User)
@UseGuards(JwtAuthGuard)
async updateClient(
  @Args('id') id: string,
  @Args('updateUserDto') updateUserDto: UpdateUserDto,
  @Context() context,
): Promise<User> {
  const authenticatedUser = context.req.user;
  const userToUpdate = await this.userService.getById(id);
  
  if (!userToUpdate || userToUpdate.role !== Role.CLIENT) {
    throw new NotFoundException(`Client with ID ${id} not found or has been deleted.`);
  }

  const updatedUser = await this.userService.update(id, updateUserDto);
  
  if (!updatedUser) {
    throw new NotFoundException(`Failed to update Client with ID ${id}.`);
  }  return updatedUser
}

@Mutation(() => User)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
async updateSuperAdminProfile(
  @Args('updateUserDto') updateUserDto: UpdateUserDto,
  @CurrentUser() superAdmin: User,
): Promise<User> {
  const user = await this.userService.getById(superAdmin._id.toString());

  if (!user) {
    throw new NotFoundException(`Super Admin not found.`);
  }

  if (user.role !== Role.SUPER_ADMIN) {
    throw new ForbiddenException(`You are not authorized to update this profile.`);
  }

  const updatedUser = await this.userService.update(user._id.toString(), updateUserDto);

  if (!updatedUser) {
    throw new NotFoundException(`Failed to update Super Admin profile.`);
  }

  return updatedUser;
}

@Mutation(() => User)
@UseGuards(JwtAuthGuard,RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
async updateAdminProfile(
  @CurrentUser() currentUser: User,
  @Args('adminId', { nullable: true }) adminId: string,
  @Args('updateUserDto') updateUserDto: UpdateUserDto,
): Promise<User> {
  // Si le Super Admin veut modifier un Admin
  if (currentUser.role === Role.SUPER_ADMIN) {
    if (!adminId) {
      throw new BadRequestException('adminId is required for Super Admin');
    }

    const updatedUser = await this.userService.update(adminId.toString(), updateUserDto);

    if (!updatedUser) {
      throw new NotFoundException(`Failed to update Admin profile.`);
    }  
  return updatedUser }

  // Si un Admin veut modifier son propre profil
  if (currentUser.role === Role.ADMIN) {
    const updatedUser = await this.userService.update(currentUser._id.toString(), updateUserDto);

    if (!updatedUser) {
      throw new NotFoundException(`Failed to update  Admin profile.`);
    }  
  return updatedUser   }

  throw new ForbiddenException('You are not authorized to update admin profiles');
}

@Mutation(() => User)
@UseGuards(JwtAuthGuard)
async updateAssistantAdminProfile(
  @CurrentUser() currentUser: User,
  @Args('assistantAdminId', { nullable: true }) assistantAdminId: string,
  @Args('updateUserDto') updateUserDto: UpdateUserDto,
): Promise<User> {
  // Si Admin veut modifier un AssistantAdmin
  if (currentUser.role === Role.ADMIN) {
    const idToUpdate = assistantAdminId ? assistantAdminId : currentUser._id.toString();

    const updatedUser = await this.userService.update(idToUpdate, updateUserDto);

    if (!updatedUser) {
      throw new NotFoundException('Failed to update Assistant Admin profile.');
    }
    return updatedUser;
  }

  // Si AssistantAdmin veut modifier lui-même son profil
  if (currentUser.role === Role.ADMIN_ASSISTANT) {
    const updatedUser = await this.userService.update(currentUser._id.toString(), updateUserDto);

    if (!updatedUser) {
      throw new NotFoundException('Failed to update Assistant Admin profile.');
    }
    return updatedUser;
  }

  throw new ForbiddenException('You are not authorized to update assistant admin profiles');
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


  @Query(() => [User], { name: 'usersByRoleInMyZone' })
@UseGuards(JwtAuthGuard)
async getUsersByRoleInMyZone(
  @Args('role', { type: () => Role }) role: Role,
  @CurrentUser() currentUser: User
): Promise<User[]> {
  const zoneResponsabilite = currentUser.zoneResponsabilite;
  if (!zoneResponsabilite) {
    throw new Error('Votre zone de responsabilité est manquante.');
  }

  return this.userService.getUserByRegionAndRole(zoneResponsabilite, role);
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
@Roles(Role.ADMIN, Role.PARTNER)
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

  // Super Admin peut supprimer n'importe qui sauf un autre Super Admin
  if (authenticatedUser.role === Role.SUPER_ADMIN) {
    if (userToDelete.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('You cannot delete another Super Admin.');
    }
    return this.softDeleteUser(id);
  }

  // Admin peut supprimer Assistant Admin, Partner ou Driver
  if (authenticatedUser.role === Role.ADMIN) {
    if (
      userToDelete.role === Role.ADMIN_ASSISTANT ||
      userToDelete.role === Role.PARTNER ||
      userToDelete.role === Role.DRIVER
    ) {
      return this.softDeleteUser(id);
    }
    throw new ForbiddenException('You can only delete Assistant Admin, Partner or Driver users.');
  }

  // Assistant Admin peut supprimer Partner ou Driver
  if (authenticatedUser.role === Role.ADMIN_ASSISTANT) {
    if (
      userToDelete.role === Role.PARTNER ||
      userToDelete.role === Role.DRIVER
    ) {
      return this.softDeleteUser(id);
    }
    throw new ForbiddenException('You can only delete Partner or Driver users.');
  }

  // Partner peut supprimer Client
  if (authenticatedUser.role === Role.PARTNER) {
    if (userToDelete.role === Role.CLIENT) {
      return this.softDeleteUser(id);
    }
    throw new ForbiddenException('You can only delete Client users.');
  }

  throw new ForbiddenException('You are not authorized to delete any users.');
}

private async softDeleteUser(id: string): Promise<User> {
  const deletedUser = await this.userService.softRemove(id);
  if (!deletedUser) {
    throw new NotFoundException(`User with ID ${id} not found.`);
  }
  return deletedUser;
}

  @Query(() => [User])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async getAllUsers(): Promise<User[]> {
    return this.userService.getAll();
  }

  @Query(() => User)
  async getUserById(@Args('id') id: string): Promise<User> {
    // Vérifier si l'ID est un ObjectId valide
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user ID');
    }
  
    // Récupérer l'utilisateur par ID
    const user = await this.userService.getById(id);
  
    if (!user) {
      throw new NotFoundException('User not found');
    }
  
    return user;
  }
  @Query(() => [User])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN,Role.ADMIN_ASSISTANT)
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
  @Roles(Role.ADMIN, Role.ADMIN_ASSISTANT)
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

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.ADMIN_ASSISTANT)
  async invalidatePartner(@Args('partnerId') partnerId: string): Promise<User> {
    return this.userService.invalidatePartner(partnerId);
  }

  @Query(() => UserCountStats)
  async getUserCounts() {
    return this.userService.getUserRoleCounts();
  }


 @Query(() => PartnerCountStats)
  async getPartnerCounts() {
    return this.userService.getPartnerCounts();
}

@Query(() => [User])
@UseGuards(JwtAuthGuard)
async getPartnerClients(
  @Args('partnerId') partnerId: string,
   @CurrentUser() currentUser: User,
) {
  console.log('Current User:', currentUser); 
  if (!currentUser) throw new UnauthorizedException('User not authenticated');
  
  partnerId = currentUser._id; // Maintenant, cela ne devrait plus planter
  return this.userService.findClientsByPartnerId(partnerId);
}

}