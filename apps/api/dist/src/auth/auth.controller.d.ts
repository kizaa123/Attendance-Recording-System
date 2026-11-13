import { Request } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
type AuthedRequest = Request & {
    user: {
        sub: string;
        email: string;
    };
};
export declare class AuthController {
    private readonly auth;
    constructor(auth: AuthService);
    login(dto: LoginDto, req: Request): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            roles: string[];
        };
    }>;
    refresh(dto: RefreshDto, req: Request): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            roles: string[];
        };
    }>;
    me(req: AuthedRequest): Promise<{
        id: string;
        email: string;
        status: import(".prisma/client").$Enums.UserStatus;
        roles: string[];
        permissions: string[];
    }>;
}
export {};
