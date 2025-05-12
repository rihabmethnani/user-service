import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class PartnerCountStats {
  @Field(() => Int)
  total: number;

 
  @Field(() => Int)
  active: number;

  @Field(() => Int)
  inactive: number;


}