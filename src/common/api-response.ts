import { HttpStatus } from '@nestjs/common';

export interface ValidationError {
  field?: string;
  message: string;
}

export interface PaginationMeta {
  page: number;

  limit: number;
  total: number;
  totalPages: number;
  unreadCount?: number;
}

export interface ApiResponse<T = unknown> {
  statusCode: number;
  success: boolean;
  message: string;
  data?: T | null;
  errors?: ValidationError[] | null;
  path?: string | null;
  timestamp: string;
  meta?: PaginationMeta | null;
}

export interface ApiSuccessResponse<T = unknown> extends ApiResponse<T> {
  success: true;
  data: T | null;
  errors: null;
}

export interface ApiErrorResponse extends ApiResponse<null> {
  success: false;
  data: null;
  errors: ValidationError[] | null;
}

export interface ApiPaginatedResponse<T = unknown> extends ApiSuccessResponse<
  T[]
> {
  meta: PaginationMeta;
}

export function success<T>(
  data: T,
  message = 'Success',
  statusCode = HttpStatus.OK,
): ApiSuccessResponse<T> {
  return {
    statusCode,
    success: true,
    message,
    data,
    errors: null,
    timestamp: new Date().toISOString(),
  };
}

export function errorRes(
  statusCode: number,
  message: string,
  errors?: ValidationError[] | null,
  path?: string | null,
): ApiErrorResponse {
  return {
    statusCode,
    success: false,
    message,
    data: null,
    errors: errors ?? null,
    path: path ?? null,
    timestamp: new Date().toISOString(),
  };
}

export function paginated<T>(
  data: T[],
  meta: PaginationMeta,
  message = 'Success',
): ApiPaginatedResponse<T> {
  return {
    statusCode: HttpStatus.OK,
    success: true,
    message,
    data,
    errors: null,
    timestamp: new Date().toISOString(),
    meta,
  };
}
