import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { forwardRef, Inject, Logger } from '@nestjs/common';
import { MatchesService } from './matches.service';

interface AuthenticatedSocket extends Socket {
  userId: string;
}

interface JoinLeavePayload {
  matchId: string;
}

@WebSocketGateway({
  cors: {
    origin: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim()),
    credentials: true,
  },
  namespace: '/matches',
})
export class MatchesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MatchesGateway.name);

  /** userId -> set of socketIds for that user (multiple devices possible) */
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => MatchesService))
    private readonly matchesService: MatchesService,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const token =
        client.handshake.auth?.token ??
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        throw new WsException('No token provided');
      }

      const payload = this.jwtService.verify<{ sub: string }>(token, {
        secret: this.config.get<string>('app.jwtSecret'),
      });

      client.userId = payload.sub;
      // Track this socket for the user (selective emit / block filtering)
      const set = this.userSockets.get(client.userId) ?? new Set<string>();
      set.add(client.id);
      this.userSockets.set(client.userId, set);
      this.logger.log(`Client connected: ${client.id} (user: ${client.userId})`);
    } catch {
      this.logger.warn(`Unauthorized connection attempt: ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    if (client.userId) {
      const set = this.userSockets.get(client.userId);
      if (set) {
        set.delete(client.id);
        if (set.size === 0) this.userSockets.delete(client.userId);
      }
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_match')
  async handleJoinMatch(
    @MessageBody() payload: JoinLeavePayload,
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
    try {
      const match = await this.matchesService.join(
        payload.matchId,
        client.userId,
      );

      await client.join(`match:${payload.matchId}`);

      this.server.to(`match:${payload.matchId}`).emit('match_updated', {
        matchId: payload.matchId,
        currentPlayers: match.currentPlayers,
        maxPlayers: match.maxPlayers,
        status: match.status,
      });

      this.server.to(`match:${payload.matchId}`).emit('player_joined', {
        matchId: payload.matchId,
        userId: client.userId,
        currentPlayers: match.currentPlayers,
      });

      // Broadcast map update to all
      this.server.emit('map_match_updated', {
        matchId: payload.matchId,
        currentPlayers: match.currentPlayers,
        maxPlayers: match.maxPlayers,
        status: match.status,
        courtId: match.courtId,
      });
    } catch (err) {
      client.emit('error', {
        event: 'join_match',
        message: err instanceof Error ? err.message : 'Failed to join match',
      });
    }
  }

  @SubscribeMessage('leave_match')
  async handleLeaveMatch(
    @MessageBody() payload: JoinLeavePayload,
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
    try {
      const match = await this.matchesService.leave(
        payload.matchId,
        client.userId,
      );

      await client.leave(`match:${payload.matchId}`);

      this.server.to(`match:${payload.matchId}`).emit('match_updated', {
        matchId: payload.matchId,
        currentPlayers: match.currentPlayers,
        maxPlayers: match.maxPlayers,
        status: match.status,
      });

      this.server.to(`match:${payload.matchId}`).emit('player_left', {
        matchId: payload.matchId,
        userId: client.userId,
        currentPlayers: match.currentPlayers,
      });

      this.server.emit('map_match_updated', {
        matchId: payload.matchId,
        currentPlayers: match.currentPlayers,
        maxPlayers: match.maxPlayers,
        status: match.status,
        courtId: match.courtId,
      });
    } catch (err) {
      client.emit('error', {
        event: 'leave_match',
        message: err instanceof Error ? err.message : 'Failed to leave match',
      });
    }
  }

  @SubscribeMessage('subscribe_match')
  async handleSubscribeMatch(
    @MessageBody() payload: JoinLeavePayload,
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
    await client.join(`match:${payload.matchId}`);
    try {
      const count = await this.matchesService.getPlayerCount(payload.matchId);
      client.emit('match_updated', {
        matchId: payload.matchId,
        currentPlayers: count,
      });
    } catch {
      // Match was deleted between subscription and fetch — ignore silently.
      // The client will get the up-to-date list on next refetch.
    }
  }

  broadcastMatchUpdate(
    matchId: string,
    data: Record<string, unknown>,
  ): void {
    this.server.to(`match:${matchId}`).emit('match_updated', data);
    this.server.emit('map_match_updated', data);
  }

  broadcastChatMessage(
    matchId: string,
    payload: Record<string, unknown>,
    excludeUserIds: string[] = [],
  ): void {
    if (excludeUserIds.length === 0) {
      this.server.to(`match:${matchId}`).emit('match_chat_message', payload);
      return;
    }
    // Selective emit: send to the match room except sockets belonging to excluded users
    const excludedSocketIds: string[] = [];
    for (const uid of excludeUserIds) {
      const sockets = this.userSockets.get(uid);
      if (sockets) {
        for (const sid of sockets) excludedSocketIds.push(sid);
      }
    }
    this.server
      .to(`match:${matchId}`)
      .except(excludedSocketIds)
      .emit('match_chat_message', payload);
  }
}
