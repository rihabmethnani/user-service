// src/file-upload/file.interceptor.ts
import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    BadRequestException,
  } from '@nestjs/common';
  import { Observable, from, isObservable } from 'rxjs';
  import { catchError, switchMap } from 'rxjs/operators';
  import { FileInterceptor } from '@nestjs/platform-express';
  import { multerConfig } from './config/multer.config';
  
  @Injectable()
  export class FileUploadInterceptor implements NestInterceptor {
    private readonly fileInterceptor: NestInterceptor;
  
    constructor() {
      this.fileInterceptor = new (FileInterceptor('image', multerConfig))();
    }
  
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
      const result = this.fileInterceptor.intercept(context, next);
      
      const observable = isObservable(result) ? result : from(result);
  
      return observable.pipe(
        catchError(error => {
          if (error.message === 'File too large') {
            throw new BadRequestException('File size exceeds 5MB limit');
          } else if (error.message.includes('Only image files')) {
            throw new BadRequestException('Only image files are allowed');
          }
          throw error;
        }),
        switchMap(data => {
          return isObservable(data) ? data : from(data);
        })
      );
    }
  }