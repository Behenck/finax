import type { InviteRoleEnumKey, InviteTypeEnumKey } from "@/http/generated";

export interface Invite {
  id: string;
  email: string | null;
  role: InviteRoleEnumKey;
  type: InviteTypeEnumKey;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  } | null;
  organization: {
    name: string;
    slug: string
  };
};
