"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const argon2 = require("argon2");
const prisma = new client_1.PrismaClient();
const ROLES = ["lecturer", "student", "attendance_officer"];
const PERMISSIONS = [
    { code: "offering.read", resource: "offering", action: "read", roles: ["lecturer", "student", "attendance_officer"] },
    { code: "session.create", resource: "session", action: "create", roles: ["lecturer", "attendance_officer"] },
    { code: "session.scan", resource: "session", action: "scan", roles: ["lecturer", "attendance_officer"] },
    { code: "report.export", resource: "report", action: "export", roles: ["lecturer", "attendance_officer"] },
    { code: "qr.revoke", resource: "qr", action: "revoke", roles: ["lecturer"] }
];
async function main() {
    for (const code of ROLES) {
        await prisma.role.upsert({
            where: { code },
            update: {},
            create: { code }
        });
    }
    for (const item of PERMISSIONS) {
        const permission = await prisma.permission.upsert({
            where: { code: item.code },
            update: { resource: item.resource, action: item.action },
            create: { code: item.code, resource: item.resource, action: item.action }
        });
        for (const roleCode of item.roles) {
            const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
            await prisma.rolePermission.upsert({
                where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
                update: {},
                create: { roleId: role.id, permissionId: permission.id }
            });
        }
    }
    let university = await prisma.university.findFirst({ where: { code: "MAIN" } });
    if (!university) {
        university = await prisma.university.create({
            data: { code: "MAIN", name: "Attendify (Dev)" }
        });
    }
    await prisma.user.deleteMany({ where: { email: "admin@attendify.local" } });
    const email = "staff@attendify.local";
    const passwordHash = await argon2.hash("ChangeMe123!", { type: argon2.argon2id });
    const user = await prisma.user.upsert({
        where: { email },
        update: { passwordHash, status: "active" },
        create: { email, passwordHash, status: "active" }
    });
    const lecturerRole = await prisma.role.findUniqueOrThrow({ where: { code: "lecturer" } });
    const existingRole = await prisma.userRole.findFirst({
        where: { userId: user.id, roleId: lecturerRole.id }
    });
    if (!existingRole) {
        await prisma.userRole.create({
            data: {
                userId: user.id,
                roleId: lecturerRole.id,
                scopeType: "university",
                scopeId: university.id
            }
        });
    }
    console.log("Seed complete.");
    console.log("Staff login:", email, "password: ChangeMe123!");
}
main()
    .catch((error) => {
    console.error(error);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map