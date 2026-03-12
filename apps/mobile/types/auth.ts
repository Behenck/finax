export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type SessionUser = {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
};

export type SessionOrganization = {
  id: string;
  name: string;
  slug: string;
  role: string;
  ownerId: string;
};

export type SessionResponse = {
  user: SessionUser;
  organization: SessionOrganization;
};
