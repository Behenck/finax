import { useAuth } from "@/hooks/use-auth";

export function useOrganizationSlug(): string {
  const { session } = useAuth();
  const slug = session?.organization.slug;

  if (!slug) {
    throw new Error("Organization slug not available");
  }

  return slug;
}
