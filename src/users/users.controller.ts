import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('api/user')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getUser() {
    return this.usersService.getUser();
  }

  @Post('profile/:id')
  switchProfile(@Param('id') profileId: string) {
    return this.usersService.setCurrentProfile(profileId);
  }

  @Get('mylist')
  getMyList() {
    return this.usersService.getMyList();
  }

  @Post('mylist/toggle')
  toggleMyList(@Body('movieId') movieId: string) {
    return this.usersService.toggleMyList(movieId);
  }

  @Post('preferences')
  updatePreferences(@Body() prefs: any) {
    return this.usersService.updatePreferences(prefs);
  }
}
