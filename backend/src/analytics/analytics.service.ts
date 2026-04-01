import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Event, EventType } from '../entities/event.entity';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AnalyticsService {
  private redis: Redis;

  constructor(
    @InjectRepository(Event) private eventRepo: Repository<Event>,
    private dataSource: DataSource,
    private config: ConfigService,
  ) {
    this.redis = new Redis({
      host: this.config.get('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
    });
  }

  async getOverview(storeId: string, query: AnalyticsQueryDto) {
    const cacheKey = `overview:${storeId}:${query.from || 'default'}:${query.to || 'default'}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const useCustomRange = query.from || query.to;
    const fromDate = query.from ? new Date(query.from) : monthStart;
    const toDate = query.to ? new Date(query.to) : now;
    const eventCountFrom = query.from ? new Date(query.from) : new Date(0);
    const eventCountTo = query.to ? new Date(query.to) : now;

    const revenueResult = useCustomRange
      ? await this.getCustomRangeRevenue(storeId, fromDate, toDate)
      : await this.getDefaultRevenue(storeId, todayStart, weekStart, monthStart);

    const eventCounts = await this.getEventCounts(storeId, eventCountFrom, eventCountTo);

    const events: Record<string, number> = {};
    for (const type of Object.values(EventType)) {
      events[type] = 0;
    }
    for (const row of eventCounts) {
      events[row.event_type] = parseInt(row.count, 10);
    }

    const pageViews = events[EventType.PAGE_VIEW] || 1;
    const purchases = events[EventType.PURCHASE] || 0;
    const conversionRate = parseFloat(((purchases / pageViews) * 100).toFixed(2));

    // Live visitors from Redis
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const liveVisitors = await this.redis.zcount(`live_visitors:${storeId}`, fiveMinAgo, '+inf');

    const result = {
      revenue: {
        today: this.toNumber(revenueResult.today),
        this_week: this.toNumber(revenueResult.this_week),
        this_month: this.toNumber(revenueResult.this_month),
      },
      events,
      conversion_rate: conversionRate,
      live_visitors: liveVisitors,
    };

    await this.redis.setex(cacheKey, 60, JSON.stringify(result));
    return result;
  }

  async getTopProducts(storeId: string, query: AnalyticsQueryDto) {
    const cacheKey = `top-products:${storeId}:${query.from || 'default'}:${query.to || 'default'}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    let qb = this.eventRepo
      .createQueryBuilder('e')
      .innerJoin('e.product', 'p')
      .select([
        'p.id AS id',
        'p.name AS name',
        'p.image_url AS image_url',
        'COALESCE(SUM(e.revenue), 0) AS revenue',
        'COUNT(*) AS units_sold',
      ])
      .where('e.store_id = :storeId', { storeId })
      .andWhere('e.event_type = :purchase', { purchase: EventType.PURCHASE })
      .groupBy('p.id')
      .addGroupBy('p.name')
      .addGroupBy('p.image_url')
      .orderBy('revenue', 'DESC')
      .limit(10);

    if (query.from) {
      qb = qb.andWhere('e.created_at >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      qb = qb.andWhere('e.created_at <= :to', { to: new Date(query.to) });
    }

    const products = await qb.getRawMany();

    const result = {
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        image_url: p.image_url,
        revenue: parseFloat(p.revenue),
        units_sold: parseInt(p.units_sold, 10),
      })),
    };

    await this.redis.setex(cacheKey, 300, JSON.stringify(result));
    return result;
  }

  async getRecentActivity(storeId: string) {
    const events = await this.eventRepo
      .createQueryBuilder('e')
      .leftJoin('e.product', 'p')
      .select([
        'e.id AS id',
        'e.event_type AS event_type',
        'p.name AS product_name',
        'e.revenue AS revenue',
        'e.session_id AS session_id',
        'e.created_at AS created_at',
      ])
      .where('e.store_id = :storeId', { storeId })
      .orderBy('e.created_at', 'DESC')
      .limit(20)
      .getRawMany();

    return {
      events: events.map((e) => ({
        id: e.id,
        event_type: e.event_type,
        product_name: e.product_name,
        revenue: e.revenue ? parseFloat(e.revenue) : null,
        session_id: e.session_id,
        created_at: e.created_at,
      })),
    };
  }

  async trackLiveVisitor(storeId: string, sessionId: string) {
    await this.redis.zadd(`live_visitors:${storeId}`, Date.now(), sessionId);
  }

  async getLiveVisitorCount(storeId: string): Promise<number> {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    await this.redis.zremrangebyscore(`live_visitors:${storeId}`, '-inf', fiveMinAgo);
    return this.redis.zcount(`live_visitors:${storeId}`, fiveMinAgo, '+inf');
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async refreshMaterializedView() {
    try {
      await this.dataSource.query('REFRESH MATERIALIZED VIEW CONCURRENTLY event_aggregates_hourly');
    } catch {
      // View may not exist yet during initial startup
    }
  }

  getRedis(): Redis {
    return this.redis;
  }

  private async getDefaultRevenue(storeId: string, todayStart: Date, weekStart: Date, monthStart: Date) {
    const [result] = await this.dataSource.query(
      `
        SELECT
          COALESCE(SUM(CASE WHEN hour_bucket >= $2 THEN total_revenue ELSE 0 END), 0) AS today,
          COALESCE(SUM(CASE WHEN hour_bucket >= $3 THEN total_revenue ELSE 0 END), 0) AS this_week,
          COALESCE(SUM(CASE WHEN hour_bucket >= $4 THEN total_revenue ELSE 0 END), 0) AS this_month
        FROM event_aggregates_hourly
        WHERE store_id = $1
          AND event_type = $5
      `,
      [storeId, todayStart, weekStart, monthStart, EventType.PURCHASE],
    );

    return result ?? { today: 0, this_week: 0, this_month: 0 };
  }

  private async getCustomRangeRevenue(storeId: string, fromDate: Date, toDate: Date) {
    const [result] = await this.dataSource.query(
      `
        SELECT
          COALESCE(SUM(total_revenue), 0) AS total
        FROM event_aggregates_hourly
        WHERE store_id = $1
          AND event_type = $2
          AND hour_bucket >= date_trunc('hour', $3::timestamptz)
          AND hour_bucket <= date_trunc('hour', $4::timestamptz)
      `,
      [storeId, EventType.PURCHASE, fromDate, toDate],
    );

    const total = this.toNumber(result?.total);
    return { today: total, this_week: total, this_month: total };
  }

  private async getEventCounts(storeId: string, fromDate: Date, toDate: Date) {
    return this.dataSource.query(
      `
        SELECT
          event_type,
          SUM(event_count)::bigint AS count
        FROM event_aggregates_hourly
        WHERE store_id = $1
          AND hour_bucket >= date_trunc('hour', $2::timestamptz)
          AND hour_bucket <= date_trunc('hour', $3::timestamptz)
        GROUP BY event_type
      `,
      [storeId, fromDate, toDate],
    );
  }

  private toNumber(value: unknown): number {
    return parseFloat(String(value ?? 0));
  }
}
