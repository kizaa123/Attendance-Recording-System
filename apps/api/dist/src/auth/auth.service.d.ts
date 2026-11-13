import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { RbacService } from "../rbac/rbac.service";
import { LoginDto } from "./dto/login.dto";
export declare class AuthService {
    private readonly prisma;
    private readonly jwt;
    private readonly config;
    private readonly audit;
    private readonly rbac;
    constructor(prisma: PrismaService, jwt: JwtService, config: ConfigService, audit: AuditService, rbac: RbacService);
    private hashToken;
    private parseTtlMs;
    private signAccessToken;
    private issueRefreshToken;
    login(dto: LoginDto, ip?: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            roles: string[];
        };
    }>;
    refresh(rawRefreshToken: string, ip?: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            roles: string[];
        };
    }>;
    me(userId: string): Promise<{
        id: string;
        email: string;
        status: import(".prisma/client").$Enums.UserStatus;
        roles: string[];
        permissions: string[];
    }>;
}
