import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Store } from './store.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  store_id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'varchar', length: 512, nullable: true })
  image_url: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Store, (store) => store.products)
  @JoinColumn({ name: 'store_id' })
  store: Store;
}
