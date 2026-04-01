import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { AnalyticsService } from './analytics.service';

@WebSocketGateway({
  namespace: '/analytics',
  cors: { origin: '*', credentials: true },
})
export class AnalyticsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedStores = new Map<string, Set<string>>(); // storeId -> Set<socketId>

  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
    private analyticsService: AnalyticsService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.config.get('JWT_SECRET', 'dev-secret-change-me'),
      });

      const storeId = payload.store_id;
      client.data.storeId = storeId;
      client.join(`store:${storeId}`);

      if (!this.connectedStores.has(storeId)) {
        this.connectedStores.set(storeId, new Set());
      }
      this.connectedStores.get(storeId)!.add(client.id);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const storeId = client.data?.storeId;
    if (storeId && this.connectedStores.has(storeId)) {
      this.connectedStores.get(storeId)!.delete(client.id);
      if (this.connectedStores.get(storeId)!.size === 0) {
        this.connectedStores.delete(storeId);
      }
    }
  }

  emitNewEvent(storeId: string, event: any) {
    this.server.to(`store:${storeId}`).emit('new-event', event);
  }

  @Interval(10000)
  async broadcastLiveVisitors() {
    for (const storeId of this.connectedStores.keys()) {
      const count = await this.analyticsService.getLiveVisitorCount(storeId);
      this.server.to(`store:${storeId}`).emit('live-visitors', { count });
    }
  }

  @Interval(30000)
  async broadcastMetricsUpdate() {
    for (const storeId of this.connectedStores.keys()) {
      const overview = await this.analyticsService.getOverview(storeId, {});
      this.server.to(`store:${storeId}`).emit('metrics-update', overview);
    }
  }
}
