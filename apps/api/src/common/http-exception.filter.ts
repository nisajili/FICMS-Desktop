import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { FicmsError } from '@ficms/database';
import { redactSensitive } from '@ficms/security';

/** Unified JSON error shape for every failed request (versioned API). */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('AllExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred.';
    let details: unknown;

    if (exception instanceof FicmsError) {
      status = exception.status;
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null) {
        const b = body as { message?: string | string[]; code?: string; details?: unknown };
        code = b.code ?? 'HTTP_ERROR';
        message = Array.isArray(b.message) ? b.message.join('; ') : (b.message ?? exception.message);
        details = b.details;
      } else {
        message = String(body);
      }
    } else if (exception instanceof Error) {
      this.logger.error(`${request.method} ${request.url} -> ${exception.message}`, exception.stack);
      message = 'An unexpected error occurred.';
      details = undefined; // never leak internal error text to clients
    }

    response.status(status).json({
      statusCode: status,
      code,
      message: redactSensitive(message),
      details,
      path: request.url,
      timestamp: new Date().toISOString()
    });
  }
}
