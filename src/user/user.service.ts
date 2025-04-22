import { ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './entities/user.entity';
import { Role } from './entities/user.entity';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RabbitMQService } from 'src/RabbitMq/rabbitmq.service';
@Injectable()
export class UserService implements OnModuleInit {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private rabbitMQService: RabbitMQService, // Injection du service RabbitMQ
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
      await this.rabbitMQService.publishEvent('ADMIN_CREATED', createdAdmin);

      console.log('Super_Admin created successfully');
    } else {
      console.log('Super_Admin already exists');
    }
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const newUser = new this.userModel({ ...createUserDto, password: hashedPassword });
    const savedUser = await newUser.save();

    // Publier un événement "USER_CREATED"
    await this.rabbitMQService.publishEvent('USER_CREATED', savedUser);

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
      await this.rabbitMQService.publishEvent('USER_UPDATED', updatedUser);
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
        await this.rabbitMQService.publishEvent('USER_DELETED', deletedUser);
      } else {
        // Publier un événement "USER_DELETION_FAILED"
        await this.rabbitMQService.publishEvent('USER_DELETION_FAILED', {
          userId: id,
          timestamp: new Date(),
        });
      }
  
      return deletedUser;
    } catch (error) {
      // Publier un événement "CRITICAL_ERROR"
      await this.rabbitMQService.publishEvent('CRITICAL_ERROR', {
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
   await this.rabbitMQService.publishEvent('PARTNER_VALIDATED', partner);

  return partner;
}
}