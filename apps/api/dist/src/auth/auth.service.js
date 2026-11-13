"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const argon2 = require("argon2");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const rbac_service_1 = require("../rbac/rbac.service");
let AuthService = class AuthService {
    prisma;
    jwt;
    config;
    audit;
    rbac;
    constructor(prisma, jwt, config, audit, rbac) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.config = config;
        this.audit = audit;
        this.rbac = rbac;
    }
    hashToken(raw) {
        return (0, crypto_1.createHash)("sha256").update(raw).digest("hex");
    }
    parseTtlMs(value, fallbackMs) {
        const match = /^(\d+)([smhd])$/.exec(value.trim());
        if (!match)
            return fallbackMs;
        const amount = Number(match[1]);
        const unit = match[2];
        const mult = unit === "s" ? 1000 : unit === "m" ? 60000 : unit === "h" ? 3600000 : 86400000;
        return amount * mult;
    }
    async signAccessToken(userId, email) {
        const secret = this.config.getOrThrow("JWT_ACCESS_SECRET");
        const ttl = this.config.get("JWT_ACCESS_TTL") || "15m";
        const expiresIn = Math.floor(this.parseTtlMs(ttl, 900000) / 1000);
        return this.jwt.signAsync({ sub: userId, email, type: "access" }, { secret, expiresIn });
    }
    async issueRefreshToken(userId) {
        const raw = (0, crypto_1.randomBytes)(48).toString("base64url");
        const tokenHash = this.hashToken(raw);
        const ttl = this.config.get("JWT_REFRESH_TTL") || "7d";
        const expiresAt = new Date(Date.now() + this.parseTtlMs(ttl, 604800000));
        await this.prisma.refreshToken.create({
            data: { userId, tokenHash, expiresAt }
        });
        return raw;
    }
    async login(dto, ip) {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
        if (!user)
            throw new common_1.UnauthorizedException({ code: "INVALID_CREDENTIALS", message: "Invalid email or password." });
        if (user.status !== "active") {
            throw new common_1.UnauthorizedException({ code: "USER_SUSPENDED", message: "Account is suspended." });
        }
        const valid = await argon2.verify(user.passwordHash, dto.password);
        if (!valid)
            throw new common_1.UnauthorizedException({ code: "INVALID_CREDENTIALS", message: "Invalid email or password." });
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
    async refresh(rawRefreshToken, ip) {
        const tokenHash = this.hashToken(rawRefreshToken);
        const record = await this.prisma.refreshToken.findFirst({
            where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
            include: { user: true }
        });
        if (!record || record.user.status !== "active") {
            throw new common_1.UnauthorizedException({ code: "INVALID_REFRESH", message: "Refresh token is invalid or expired." });
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
    async me(userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.UnauthorizedException();
        const roles = await this.rbac.userRoleCodes(userId);
        const permissions = await this.rbac.userPermissionCodes(userId);
        return { id: user.id, email: user.email, status: user.status, roles, permissions };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService,
        audit_service_1.AuditService,
        rbac_service_1.RbacService])
], AuthService);
//# sourceMappingURL=auth.service.js.map