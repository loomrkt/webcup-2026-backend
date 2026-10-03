import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { errorRes, ValidationError } from './api-response';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body = errorRes(
      status,
      exception instanceof HttpException
        ? this.resolveMessage(exception)
        : 'Internal server error',
      exception instanceof HttpException ? this.resolveErrors(exception) : null,
      request.url,
    );

    response.status(status).json(body);
  }

  private resolveMessage(exception: HttpException): string {
    const payload = exception.getResponse();
    if (typeof payload === 'string') return payload;
    if (typeof payload === 'object' && payload !== null) {
      const message = (payload as Record<string, unknown>)?.message;
      if (typeof message === 'string') return message;
      if (Array.isArray(message) && typeof message[0] === 'string')
        return message[0];
    }
    return exception.message || 'Request failed';
  }

  private resolveErrors(exception: HttpException): ValidationError[] | null {
    const payload = exception.getResponse();
    if (typeof payload === 'object' && payload !== null) {
      const message = (payload as Record<string, unknown>)?.message;
      if (Array.isArray(message)) {
        return message.map((m) => {
          if (typeof m === 'string') return { message: m };
          return m as ValidationError;
        });
      }
    }
    return null;
  }
}
