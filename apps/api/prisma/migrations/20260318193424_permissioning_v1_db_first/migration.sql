-- CreateEnum
CREATE TYPE "PermissionOverrideEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateEnum
CREATE TYPE "PermissionAuditChangeType" AS ENUM ('ROLE_PRESET_REPLACED', 'MEMBER_OVERRIDE_REPLACED');

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_role_permissions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "permission_id" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_permission_overrides" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "effect" "PermissionOverrideEffect" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_permission_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_audit_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "target_member_id" TEXT,
    "target_role" "Role",
    "change_type" "PermissionAuditChangeType" NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "permissions_module_idx" ON "permissions"("module");

-- CreateIndex
CREATE INDEX "permissions_is_active_idx" ON "permissions"("is_active");

-- CreateIndex
CREATE INDEX "organization_role_permissions_organization_id_role_idx" ON "organization_role_permissions"("organization_id", "role");

-- CreateIndex
CREATE INDEX "organization_role_permissions_permission_id_idx" ON "organization_role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_role_permissions_organization_id_role_permissi_key" ON "organization_role_permissions"("organization_id", "role", "permission_id");

-- CreateIndex
CREATE INDEX "member_permission_overrides_organization_id_member_id_idx" ON "member_permission_overrides"("organization_id", "member_id");

-- CreateIndex
CREATE INDEX "member_permission_overrides_permission_id_idx" ON "member_permission_overrides"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_permission_overrides_member_id_permission_id_key" ON "member_permission_overrides"("member_id", "permission_id");

-- CreateIndex
CREATE INDEX "permission_audit_logs_organization_id_created_at_idx" ON "permission_audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "permission_audit_logs_actor_user_id_idx" ON "permission_audit_logs"("actor_user_id");

-- CreateIndex
CREATE INDEX "permission_audit_logs_target_member_id_idx" ON "permission_audit_logs"("target_member_id");

-- AddForeignKey
ALTER TABLE "organization_role_permissions" ADD CONSTRAINT "organization_role_permissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_role_permissions" ADD CONSTRAINT "organization_role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_permission_overrides" ADD CONSTRAINT "member_permission_overrides_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_permission_overrides" ADD CONSTRAINT "member_permission_overrides_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_permission_overrides" ADD CONSTRAINT "member_permission_overrides_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_audit_logs" ADD CONSTRAINT "permission_audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_audit_logs" ADD CONSTRAINT "permission_audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_audit_logs" ADD CONSTRAINT "permission_audit_logs_target_member_id_fkey" FOREIGN KEY ("target_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
