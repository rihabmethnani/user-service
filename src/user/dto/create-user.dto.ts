import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { Role, TunisianRegion } from '../entities/user.entity';

@InputType()
export class CreateUserDto {
  @Field()
  @IsString()
  name: string;

  @Field()
  @IsEmail()
  email: string;

  @Field()
  @IsString()
  @MinLength(6)
  password: string;

  @Field(() => Role, { nullable: true })
  @IsOptional()
  role?: Role;

  @Field({ nullable: true })
  @IsOptional()
  phone?: string;

  @Field({ nullable: true })
  @IsOptional()
  address?: string;

  @Field({ nullable: true })
  @IsOptional()
  image?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  createdBy?: string; 

  @Field(() => String, { nullable: true })
  @IsOptional()
  companyName?: string;


  @Field(() => String, { nullable: true })
  @IsOptional()
  positionGPS?: string; 

  @Field(() => TunisianRegion,{ nullable: true }) 
   @IsOptional()
  zoneResponsabilite?: TunisianRegion; 

}