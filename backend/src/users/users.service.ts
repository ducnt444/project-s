import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  findByEmail(email: string) {
    return this.users.findOne({ where: { email: email.toLowerCase() } });
  }

  findById(id: string) {
    return this.users.findOne({ where: { id } });
  }

  create(email: string, passwordHash: string, displayName?: string) {
    return this.users.save(
      this.users.create({
        email: email.toLowerCase(),
        passwordHash,
        displayName: displayName ?? null,
      }),
    );
  }
}
