import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Event, EventType } from '../entities/event.entity';
import { Store } from '../entities/store.entity';
import { Product } from '../entities/product.entity';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsGateway } from '../analytics/analytics.gateway';
import { randomUUID } from 'crypto';

const EVENT_WEIGHTS: [EventType, number][] = [
  [EventType.PAGE_VIEW, 0.60],
  [EventType.ADD_TO_CART, 0.20],
  [EventType.REMOVE_FROM_CART, 0.05],
  [EventType.CHECKOUT_STARTED, 0.10],
  [EventType.PURCHASE, 0.05],
];

@Injectable()
export class SimulatorService implements OnModuleInit {
  private stores: Store[] = [];
  private products: Map<string, Product[]> = new Map();
  private activeSessions: Map<string, string[]> = new Map();

  constructor(
    @InjectRepository(Store) private storeRepo: Repository<Store>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Event) private eventRepo: Repository<Event>,
    private config: ConfigService,
    private analyticsService: AnalyticsService,
    private analyticsGateway: AnalyticsGateway,
  ) {}

  async onModuleInit() {
    const enabled = this.config.get('ENABLE_SIMULATOR', 'false');
    if (enabled !== 'true') return;

    this.stores = await this.storeRepo.find();
    if (this.stores.length === 0) {
      console.log('Simulator: No stores found. Run seed first.');
      return;
    }

    for (const store of this.stores) {
      const products = await this.productRepo.find({ where: { store_id: store.id } });
      this.products.set(store.id, products);
      const sessions = Array.from({ length: 10 + Math.floor(Math.random() * 10) }, () => `sess_${randomUUID().slice(0, 8)}`);
      this.activeSessions.set(store.id, sessions);
    }

    const eventsPerSecond = parseInt(this.config.get('SIMULATOR_EVENTS_PER_SECOND', '100'), 10);
    const intervalMs = Math.max(10, Math.floor(1000 / eventsPerSecond));

    console.log(`Simulator: Generating ~${eventsPerSecond} events/sec across ${this.stores.length} stores`);
    setInterval(() => this.generateEvent(), intervalMs);
  }

  private pickEventType(): EventType {
    const r = Math.random();
    let cumulative = 0;
    for (const [type, weight] of EVENT_WEIGHTS) {
      cumulative += weight;
      if (r <= cumulative) return type;
    }
    return EventType.PAGE_VIEW;
  }

  private async generateEvent() {
    const store = this.stores[Math.floor(Math.random() * this.stores.length)];
    const products = this.products.get(store.id);
    if (!products || products.length === 0) return;

    const product = products[Math.floor(Math.random() * products.length)];
    const eventType = this.pickEventType();

    const sessions = this.activeSessions.get(store.id)!;
    if (Math.random() < 0.05) {
      sessions.push(`sess_${randomUUID().slice(0, 8)}`);
    }
    if (Math.random() < 0.05 && sessions.length > 5) {
      sessions.splice(Math.floor(Math.random() * sessions.length), 1);
    }
    const sessionId = sessions[Math.floor(Math.random() * sessions.length)];

    const event = this.eventRepo.create({
      store_id: store.id,
      product_id: eventType === EventType.PAGE_VIEW && Math.random() < 0.3 ? undefined : product.id,
      event_type: eventType,
      revenue: eventType === EventType.PURCHASE ? product.price : undefined,
      session_id: sessionId,
      metadata: {},
    });

    await this.eventRepo.save(event);

    await this.analyticsService.trackLiveVisitor(store.id, sessionId);

    this.analyticsGateway.emitNewEvent(store.id, {
      id: event.id,
      event_type: event.event_type,
      product_name: product.name,
      revenue: event.revenue,
      session_id: event.session_id,
      created_at: event.created_at,
    });
  }
}
