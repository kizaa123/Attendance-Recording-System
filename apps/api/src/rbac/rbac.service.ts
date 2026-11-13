import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async userPermissionCodes(userId: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true }
            }
          }
        }
      }
    });
    const codes = new Set<string>();
    rows.forEach((userRole) => {
      userRole.role.rolePermissions.forEach((rp) => codes.add(rp.permission.code));
    });
    return Array.from(codes);
  }

  async userRoleCodes(userId: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true }
    });
    return rows.map((row) => row.role.code);
  }

  async hasPermission(userId: string, permissionCode: string): Promise<boolean> {
    const codes = await this.userPermissionCodes(userId);
    return codes.includes(permissionCode);
  }
}
