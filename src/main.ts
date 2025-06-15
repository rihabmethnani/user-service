// src/main.ts

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);  // Servir les fichiers statiques depuis le dossier "uploads"
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });
  // Activez CORS avec une configuration spécifique
  app.enableCors({
    origin: '*', // ou spécifiez l’origine exacte
    credentials: true,
  });
  

  await app.listen(4000, '0.0.0.0');
}
bootstrap();