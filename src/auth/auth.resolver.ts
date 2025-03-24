import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { AuthResponse } from './dto/auth-response';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => AuthResponse)
  async login(@Args('email') email: string, @Args('password') password: string): Promise<AuthResponse> {
    const user = await this.authService.validateUser(email, password);
    if (!user) {
      throw new Error('Invalid credentials');
    }
   return  this.authService.login(user);
   
  }

  @Mutation(() => Boolean)
  async validateToken(@Args('token') token: string): Promise<boolean> {
    const { isValid } = await this.authService.validateToken(token);
    return isValid;
  }
}