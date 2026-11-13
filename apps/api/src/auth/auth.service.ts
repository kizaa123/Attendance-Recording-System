import {
  ConflictException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { RbacService } from "../rbac/rbac.service";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly rbac: RbacService
  ) {}

  private hashToken(raw: string) {
    return createHash("sha256").update(raw).digest("hex");
  }

  private parseTtlMs(value: string, fallbackMs: number) {
    const match = /^(\d+)([smhd])$/.exec(value.trim());
    if (!match) return fallbackMs;
    const amount = Number(match[1]);
    const unit = match[2];
    const mult = unit === "s" ? 1000 : unit === "m" ? 60000 : unit === "h" ? 3600000 : 86400000;
    return amount * mult;
  }

  private async signAccessToken(userId: string, email: string) {
    const secret = this.config.getOrThrow<string>("JWT_ACCESS_SECRET");
    const ttl = this.config.get<string>("JWT_ACCESS_TTL") || "15m";
    const expiresIn = Math.floor(this.parseTtlMs(ttl, 900000) / 1000);
    return this.jwt.signAsync({ sub: userId, email, type: "access" }, { secret, expiresIn });
  }

  private async issueRefreshToken(userId: string) {
    const raw = randomBytes(48).toString("base64url");
    const tokenHash = this.hashToken(raw);
    const ttl = this.config.get<string>("JWT_REFRESH_TTL") || "7d";
    const expiresAt = new Date(Date.now() + this.parseTtlMs(ttl, 604800000));
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt }
    });
    return raw;
  }

  async login(dto: LoginDto, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user) throw new UnauthorizedException({ code: "INVALID_CREDENTIALS", message: "Invalid email or password." });
    if (user.status !== "active") {
      throw new UnauthorizedException({ code: "USER_SUSPENDED", message: "Account is suspended." });
    }
    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException({ code: "INVALID_CREDENTIALS", message: "Invalid email or password." });

    const accessToken = await this.signAccessToken(user.id, user.email);
    const refreshToken = await this.issueRefreshToken(user.id);
    const roles = await this.rbac.userRoleCodes(user.id);

    await this.audit.log({
      actorUserId: user.id,
      action: "auth.login",
      entityType: "user",
      entityId: user.id,
      ip
    });

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, roles }
    };
  }

  async refresh(rawRefreshToken: string, ip?: string) {
    const tokenHash = this.hashToken(rawRefreshToken);
    const record = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true }
    });
    if (!record || record.user.status !== "active") {
      throw new UnauthorizedException({ code: "INVALID_REFRESH", message: "Refresh token is invalid or expired." });
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() }
    });

    const accessToken = await this.signAccessToken(record.user.id, record.user.email);
    const refreshToken = await this.issueRefreshToken(record.user.id);
    const roles = await this.rbac.userRoleCodes(record.user.id);

    await this.audit.log({
      actorUserId: record.user.id,
      action: "auth.refresh",
      entityType: "user",
      entityId: record.user.id,
      ip
    });

    return {
      accessToken,
      refreshToken,
      user: { id: record.user.id, email: record.user.email, roles }
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const roles = await this.rbac.userRoleCodes(userId);
    const permissions = await this.rbac.userPermissionCodes(userId);
    return { id: user.id, email: user.email, status: user.status, roles, permissions };
  }
}
