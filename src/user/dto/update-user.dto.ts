import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { Role } from '../entities/user.entity';

@InputType()
export class UpdateUserDto {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  name: string;

  @Field({ nullable: true })
  @IsEmail()
  @IsOptional()
  email: string;

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
    companyName?: string;
  
    @Field(() => String, { nullable: true })
    @IsOptional()
    positionGPS?: string; 

}