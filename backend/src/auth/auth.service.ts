import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { User } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { LoginDto, RegisterDto } from './auth.dto.js';

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    if (await this.users.findByEmail(dto.email)) {
      throw new ConflictException('Email is already registered');
    }
    const hash = await bcrypt.hash(dto.password, 12);
    const user = await this.users.create(dto.email, hash, dto.displayName);
    return this.issueToken(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueToken(user);
  }

  toProfile(user: User) {
    return { id: user.id, email: user.email, displayName: user.displayName };
  }

  private async issueToken(user: User) {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: this.toProfile(user),
    };
  }
}
