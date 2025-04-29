import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './entities/user.entity';
import { UserService } from './user.service';
import { UserResolver } from './user.resolver';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { RabbitMQProducer } from 'src/RabbitMq/rabbitmq.service';
@Module({
    imports: [
      ConfigModule,
      MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]), // Assurez-vous que ceci est bien présent
      forwardRef(() => AuthModule),
    ],
    providers: [UserService, UserResolver,RabbitMQProducer],
    exports: [UserService, MongooseModule], // Exportez MongooseModule pour rendre UserModel accessible
  })
  export class UserModule {}
  
