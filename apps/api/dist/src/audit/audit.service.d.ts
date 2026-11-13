import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
export declare class AuditService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    log(input: {
        actorUserId?: string;
        action: string;
        entityType: string;
        entityId?: string;
        metadata?: Prisma.InputJsonValue;
        ip?: string;
    }): Promise<void>;
}
