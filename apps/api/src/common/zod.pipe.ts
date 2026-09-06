import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodSchema, ZodError } from 'zod';

/**
 * Zod validation pipe: `new ZodValidationPipe(schema)` validates `body`,
 * `query` or `params` and passes the parsed (and typed) result downstream.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>, private readonly source: 'body' | 'query' | 'params' = 'body') {}

  transform(value: unknown, metadata: ArgumentMetadata): T {
    if (metadata.type !== this.source) return value as T;
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed.',
        details: this.format(result.error)
      });
    }
    return result.data;
  }

  private format(error: ZodError): unknown {
    return error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code
    }));
  }
}
