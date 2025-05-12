import { ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './entities/user.entity';
import { Role } from './entities/user.entity';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RabbitMQProducer } from 'src/RabbitMq/rabbitmq.service';
@Injectable()
export class UserService implements OnModuleInit {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private rabbitMQProducer: RabbitMQProducer, 
  ) {}

  async onModuleInit() {
    await this.createAdminIfNotExist();
  }

  private async createAdminIfNotExist() {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      throw new Error('ADMIN_EMAIL is not defined in environment variables');
    }

    const admin = await this.userModel.findOne({ email: adminEmail }).exec();
    if (!admin) {
      const hashedPassword = await bcrypt.hash('superAdmin123', 10);
      const adminDto = {
        email: adminEmail,
        password: hashedPassword,
        role: Role.SUPER_ADMIN,
        name: 'Super_Admin',
      };

      const createdAdmin = await this.userModel.create(adminDto);

      // Publier un événement "USER_CREATED" pour l'admin
      await this.rabbitMQProducer.publishEvent('ADMIN_CREATED', createdAdmin);

      console.log('Super_Admin created successfully');
    } else {
      console.log('Super_Admin already exists');
    }
  }


  private async publishUserCreatedEvent(user: User) {
    const eventPayload = {
      eventType: 'USER_CREATED', // Utilise exactement ce que le consumer attend
      timestamp: new Date().toISOString(),
      payload: {
        userId: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.role === Role.PARTNER ? 'PENDING_VALIDATION' : 'ACTIVE',
      },
    };
  
    await this.rabbitMQProducer.publishEvent(
      `CREATED_${user.role}`,
      eventPayload
    );
    
    
  }
  
  async create(createUserDto: CreateUserDto): Promise<User> {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const newUser = new this.userModel({ ...createUserDto, password: hashedPassword });
    const savedUser = await newUser.save();

    // Publier un événement "USER_CREATED"
  // await this.publishUserCreatedEvent(savedUser);
    return savedUser;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User | null> {
    const updatedUser = await this.userModel
      .findOneAndUpdate(
        { _id: id, deletedAt: null },
        { ...updateUserDto, updatedAt: new Date() },
        { new: true },
      )
      .exec();

    if (updatedUser) {
      // Publier un événement "USER_UPDATED"
      await this.rabbitMQProducer.publishEvent('USER_UPDATED', updatedUser);
    }

    return updatedUser;
  }

  async softRemove(id: string): Promise<User | null> {
    try {
      const deletedUser = await this.userModel
        .findByIdAndUpdate(id, { deletedAt: new Date() }, { new: true })
        .exec();
  
      if (deletedUser) {
        // Publier un événement "USER_DELETED"
        await this.rabbitMQProducer.publishEvent('USER_DELETED', deletedUser);
      } else {
        // Publier un événement "USER_DELETION_FAILED"
        await this.rabbitMQProducer.publishEvent('USER_DELETION_FAILED', {
          userId: id,
          timestamp: new Date(),
        });
      }
  
      return deletedUser;
    } catch (error) {
      // Publier un événement "CRITICAL_ERROR"
      await this.rabbitMQProducer.publishEvent('CRITICAL_ERROR', {
        action: 'USER_SOFT_REMOVE',
        userId: id,
        error: error.message,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async getById(id: string): Promise<User | null> {
    return this.userModel.findOne({ _id: id, deletedAt: null }).exec();
  }

  async getAll(): Promise<User[]> {
    return this.userModel.find({ deletedAt: null }).exec();
  }

  async getByRole(role: Role): Promise<User[]> {
    return this.userModel.find({ role, deletedAt: null }).exec();
  }


  async findClientsByPartnerId(partnerId: string): Promise<User[]> {
    return this.userModel.find({
      role: Role.CLIENT,
      createdBy: partnerId,
      deletedAt : null
    }).exec();
  }

  async getUserByRegionAndRole(zoneResponsabilite: string, role: Role): Promise<User[]> {
    return this.userModel.find({
      zoneResponsabilite,
      role,
      deletedAt: null
    }).exec();
  }
  

  
async validatePartner(partnerId: string): Promise<User> {
  const partner = await this.userModel.findByIdAndUpdate(
    partnerId,
    { 
      isValid: true,
      updatedAt: new Date() 
    },
    { new: true }
  ).exec();

  if (!partner) {
    throw new NotFoundException(`Partner with ID ${partnerId} not found.`);
  }

  // Vérifier que c'est bien un partenaire
  if (partner.role !== Role.PARTNER) {
    throw new ForbiddenException('Only PARTNER users can be validated.');
  }
   // Publier un événement PARTNER_VALIDATED via RabbitMQ 
   await this.rabbitMQProducer.publishEvent('PARTNER_VALIDATED', partner);

  return partner;
}


async invalidatePartner(partnerId: string): Promise<User> {
  const partner = await this.userModel.findByIdAndUpdate(
    partnerId,
    {
      isValid: false,
      updatedAt: new Date(),
    },
    { new: true }
  ).exec();

  if (!partner) {
    throw new NotFoundException(`Partner with ID ${partnerId} not found.`);
  }

  if (partner.role !== Role.PARTNER) {
    throw new ForbiddenException('Only PARTNER users can be invalidated.');
  }

  await this.rabbitMQProducer.publishEvent('PARTNER_INVALIDATED', partner);

  return partner;
}


async getUserRoleCounts(): Promise<{
  drivers: number;
  adminAssistants: number;
}> {
  const [drivers, adminAssistants] = await Promise.all([
    this.userModel.countDocuments({ role: Role.DRIVER, deletedAt: null }).exec(),
    this.userModel.countDocuments({ role: Role.ADMIN_ASSISTANT, deletedAt: null }).exec(),
  ]);

  return {
    drivers,
    adminAssistants,
  };
}
async getPartnerCounts(): Promise<{
  total: number;
  active: number;
  inactive: number;
}> {
  const [total, active] = await Promise.all([
    this.userModel.countDocuments({ role: Role.PARTNER, deletedAt: null }).exec(),
    this.userModel.countDocuments({ role: Role.PARTNER, deletedAt: null, isValid: true }).exec(),
  ]);

  return {
    total,
    active,
    inactive: total - active,
  };
}


}