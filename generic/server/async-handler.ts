import type { NextFunction, Request, RequestHandler, Response } from 'express';

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Wraps an async route handler so a thrown error or rejected promise reaches Express's error handling.
 *
 * AppKit runs Express 4, which ignores the promise an async handler returns: without this wrapper a failure
 * leaves the request hanging until the client gives up. Every async handler passed to `app.get`, `app.post`
 * and the like goes through it.
 */
export function asyncHandler(handler: AsyncRouteHandler): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
