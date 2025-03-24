import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
   // Activez CORS avec une configuration spécifique
  //  app.enableCors({
  //   origin: 'http://localhost:3000', // Autorise uniquement le frontend
  //   methods: ['GET', 'POST', 'PUT', 'DELETE'], // Méthodes HTTP autorisées
  //   allowedHeaders: ['Content-Type', 'Authorization'], // Headers autorisés
  //   credentials: true, // Autorise les cookies ou les tokens d'authentification
  // });

  await app.listen(3000);
}
bootstrap();