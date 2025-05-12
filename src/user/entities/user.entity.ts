import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum Role {
  SUPER_ADMIN="SUPER_ADMIN",
  ADMIN = 'ADMIN',
  ADMIN_ASSISTANT='ADMIN_ASSISTANT',
  PARTNER = 'PARTNER',
  CLIENT = 'CLIENT',
  DRIVER = 'DRIVER',
}

export enum TunisianRegion {
  ARIANA = 'Ariana',
  BEJA = 'Béja',
  BEN_AROUS = 'Ben Arous',
  BIZERTE = 'Bizerte',
  GABES = 'Gabès',
  GAFSA = 'Gafsa',
  JENDOUBA = 'Jendouba',
  KAIROUAN = 'Kairouan',
  KASSERINE = 'Kasserine',
  KEBILI = 'Kébili',
  KEF = 'Le Kef',
  MAHDIA = 'Mahdia',
  MANOUBA = 'La Manouba',
  MEDENINE = 'Médenine',
  MONASTIR = 'Monastir',
  NABEUL = 'Nabeul',
  SFAX = 'Sfax',
  SIDI_BOUZID = 'Sidi Bouzid',
  SILIANA = 'Siliana',
  SOUSSE = 'Sousse',
  TATAOUINE = 'Tataouine',
  TOZEUR = 'Tozeur',
  TUNIS = 'Tunis',
  ZAGHOUAN = 'Zaghouan',
}

registerEnumType(Role, {
  name: 'Role',
  description: 'User roles',
});


registerEnumType(TunisianRegion, {
  name: 'TunisianRegion',
  description: ' TunisianRegion',
});

@ObjectType()
@Schema({ timestamps: true }) // Active les timestamps pour createdAt et updatedAt
export class User extends Document {
  @Field(() => ID)
  declare _id: string;

  @Field()
  @Prop({ required: true })
  name: string;

  @Field()
  @Prop({ required: true, unique: true })
  email: string;

  @Field()
  @Prop({ required: true })
  password: string;

  @Field(() => Role)
  @Prop({ enum: Role}) 
  role: Role;

  @Field({ nullable: true }) 
  @Prop() 
  phone?: string;

  @Field({ nullable: true }) 
  @Prop() 
  address?: string;

  @Field({ nullable: true }) 
  @Prop() 
  image?: string;

  @Field(() => ID, { nullable: true }) 
  @Prop() 
  createdBy?: string; 

  @Field({ nullable: true }) 
  @Prop() 
  companyName?: string;

  @Field({ nullable: true }) 
  @Prop() 
  positionGPS?: string;

  @Field(() => TunisianRegion, { nullable: true })
  @Prop({ enum: TunisianRegion })
  zoneResponsabilite?: string;

  @Field({defaultValue: false})
  @Prop()
  isValid?: boolean;


  @Field(() => Date) 
  @Prop()
  createdAt: Date;

  @Field(() => Date) 
  @Prop()
  updatedAt: Date;

  @Field(() => Date, { nullable: true, defaultValue: null }) 
  @Prop() 
  deletedAt?: Date; 
}

export const UserSchema = SchemaFactory.createForClass(User);