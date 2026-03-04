import { getMe, type GetMe200 } from "@/http/generated";

export async function getProfile(): Promise<GetMe200["user"]> {
  const data = await getMe();

  return data.user
}
