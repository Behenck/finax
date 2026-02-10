import { getProfile as getProfileRoute, type GetProfile200 } from "@/http/generated";

export async function getProfile(): Promise<GetProfile200> {
  const data = await getProfileRoute();

  return data.user;
}
