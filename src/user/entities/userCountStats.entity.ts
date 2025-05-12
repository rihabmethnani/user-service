import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class UserCountStats {

 
  @Field(() => Int)
  drivers: number;

  @Field(() => Int)
  adminAssistants: number;


}