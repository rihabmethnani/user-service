// src/file-upload/file-upload.module.ts
import { Module } from '@nestjs/common';
import { FileUploadInterceptor } from './file.interceptor';

@Module({
  providers: [FileUploadInterceptor],
  exports: [FileUploadInterceptor],
})
export class FileUploadModule {}