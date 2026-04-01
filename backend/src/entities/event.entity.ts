import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Store } from './store.entity';
import { Product } from './product.entity';

export enum EventType {
  PAGE_VIEW = 'page_view',
  ADD_TO_CART = 'add_to_cart',
  REMOVE_FROM_CART = 'remove_from_cart',
  CHECKOUT_STARTED = 'checkout_started',
  PURCHASE = 'purchase',
}

@Entity('events')
@Index(['store_id', 'created_at'])
@Index(['store_id', 'event_type', 'created_at'])
@Index(['store_id', 'product_id', 'event_type'])
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  store_id: string;

  @Column({ type: 'uuid', nullable: true })
  product_id: string;

  @Column({ type: 'enum', enum: EventType })
  event_type: EventType;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  revenue: number;

  @Column({ type: 'varchar', length: 255 })
  session_id: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Store, (store) => store.events)
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
