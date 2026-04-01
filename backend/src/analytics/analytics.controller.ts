import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { StoreId } from '../common/decorators/store-id.decorator';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('overview')
  getOverview(@StoreId() storeId: string, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getOverview(storeId, query);
  }

  @Get('top-products')
  getTopProducts(@StoreId() storeId: string, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getTopProducts(storeId, query);
  }

  @Get('recent-activity')
  getRecentActivity(@StoreId() storeId: string) {
    return this.analyticsService.getRecentActivity(storeId);
  }
}
