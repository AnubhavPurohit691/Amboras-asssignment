import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Product } from './product.entity';
import { Event } from './event.entity';
import { User } from './user.entity';

@Entity('stores')
export class Store {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => Product, (product) => product.store)
  products: Product[];

  @OneToMany(() => Event, (event) => event.store)
  events: Event[];

  @OneToMany(() => User, (user) => user.store)
  users: User[];
}
