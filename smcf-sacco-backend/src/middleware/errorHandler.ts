import { Request, Response, NextFunction } from 'express';

interface ErrorResponse extends Error {
  statusCode?: number;
  code?: number;
  keyValue?: Record<string, unknown>;
  keyPattern?: Record<string, unknown>;
  errors?: Record<string, unknown>;
  duplicateFields?: string[];
}

const errorHandler = (err: ErrorResponse, req: Request, res: Response, next: NextFunction) => {
  let error = { ...err };
  error.message = err.message;

  // Log to console for dev
  console.error(err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { ...error, statusCode: 404, message };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    let duplicateFields = Object.keys(err.keyValue || err.keyPattern || {});

    if (duplicateFields.length === 0) {
      const match = String(err.message || '').match(/index:\s*([^\s]+)\s*dup key/i);
      if (match?.[1]) {
        duplicateFields = match[1]
          .replace(/_1/g, '')
          .split('_')
          .filter(Boolean);
      }
    }

    const fieldMessage = duplicateFields.length ? ` (${duplicateFields.join(', ')})` : '';
    const message = `Duplicate field value entered${fieldMessage}`;
    error = { ...error, statusCode: 400, message, duplicateFields };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors || {})
      .map((val) => {
        if (val && typeof val === 'object' && 'message' in val) {
          const maybeMessage = (val as { message?: unknown }).message;
          if (typeof maybeMessage === 'string') {
            return maybeMessage;
          }
        }
        return '';
      })
      .filter(Boolean)
      .join(', ');
    error = { ...error, statusCode: 400, message };
  }

  const response: Record<string, unknown> = {
    success: false,
    message: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  };

  if (Array.isArray(error.duplicateFields) && error.duplicateFields.length > 0) {
    response.duplicateFields = error.duplicateFields;
  }

  res.status(error.statusCode || 500).json(response);
};

export default errorHandler;
