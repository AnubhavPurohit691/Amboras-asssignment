import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { Store } from '../entities/store.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Store) private storeRepo: Repository<Store>,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const store = this.storeRepo.create({
      name: dto.storeName,
      slug: dto.storeName.toLowerCase().replace(/\s+/g, '-'),
    });
    await this.storeRepo.save(store);

    const password_hash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      email: dto.email,
      password_hash,
      name: dto.name,
      store_id: store.id,
    });
    await this.userRepo.save(user);

    const token = this.signToken(user);
    return {
      access_token: token,
      user: { id: user.id, email: user.email, name: user.name, store_id: store.id },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const token = this.signToken(user);
    return {
      access_token: token,
      user: { id: user.id, email: user.email, name: user.name, store_id: user.store_id },
    };
  }

  private signToken(user: User): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      store_id: user.store_id,
    });
  }
}
