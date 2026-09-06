import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { RequirePermissions } from '../../common/permissions.guard';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { UsersService } from './users.service';
import { CreateUserSchema, UpdateUserSchema, UpdateRoleSchema } from './users.schemas';

@ApiTags('users')
@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions('user:view')
  list() {
    return this.users.list();
  }

  @Post()
  @RequirePermissions('user:create')
  create(@Body(new ZodValidationPipe(CreateUserSchema)) body: Parameters<UsersService['create']>[0]) {
    return this.users.create(body);
  }

  @Patch(':id')
  @RequirePermissions('user:update')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateUserSchema)) body: Parameters<UsersService['update']>[1]) {
    return this.users.update(id, body);
  }

  @Get('roles')
  @RequirePermissions('user:view')
  roles() {
    return this.users.roles();
  }

  @Patch('roles/:id')
  @RequirePermissions('user:update')
  updateRole(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateRoleSchema)) body: { label?: string; description?: string | null; permissions?: string[] }) {
    return this.users.updateRole(id, body);
  }
}
