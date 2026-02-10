import type { InviteRoleEnum2Key, InviteRoleEnumKey, InviteTypeEnumKey } from "@/http/generated";

export interface Invite {
  id: string;
  email: string | null;
  role: InviteRoleEnumKey | InviteRoleEnum2Key;
  type: InviteTypeEnumKey;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  } | null;
  organization: {
    name: string;
    slug: string | null
  };
};