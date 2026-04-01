import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Store } from './entities/store.entity';
import { Product } from './entities/product.entity';
import { Event } from './entities/event.entity';
import { User } from './entities/user.entity';
import { AuthModule } from './auth/auth.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SimulatorModule } from './simulator/simulator.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DATABASE_HOST', 'localhost'),
        port: config.get<number>('DATABASE_PORT', 5432),
        username: config.get('DATABASE_USER', 'amboras'),
        password: config.get('DATABASE_PASSWORD', 'amboras_dev'),
        database: config.get('DATABASE_NAME', 'amboras_analytics'),
        entities: [Store, Product, Event, User],
        synchronize: true,
      }),
    }),
    AuthModule,
    AnalyticsModule,
    SimulatorModule,
  ],
})
export class AppModule {}
