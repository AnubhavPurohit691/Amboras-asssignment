import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Store } from '../entities/store.entity';
import { Product } from '../entities/product.entity';
import { Event } from '../entities/event.entity';
import { SimulatorService } from './simulator.service';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Store, Product, Event]),
    AnalyticsModule,
  ],
  providers: [SimulatorService],
})
export class SimulatorModule {}
