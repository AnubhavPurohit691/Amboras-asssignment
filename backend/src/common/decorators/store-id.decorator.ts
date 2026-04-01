import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const StoreId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.user.store_id;
  },
);
