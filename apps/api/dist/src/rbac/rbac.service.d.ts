import { PrismaService } from "../prisma/prisma.service";
export declare class RbacService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    userPermissionCodes(userId: string): Promise<string[]>;
    userRoleCodes(userId: string): Promise<string[]>;
    hasPermission(userId: string, permissionCode: string): Promise<boolean>;
}
