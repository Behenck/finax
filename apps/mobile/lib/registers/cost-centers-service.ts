import { deleteOrganizationsSlugCostcentersCostcenterid } from "@/http/generated/deleteOrganizationsSlugCostcentersCostcenterid";
import { getOrganizationsSlugCostcenters } from "@/http/generated/getOrganizationsSlugCostcenters";
import { postOrganizationsSlugCostcenters } from "@/http/generated/postOrganizationsSlugCostcenters";
import { putOrganizationsSlugCostcentersCostcenterid } from "@/http/generated/putOrganizationsSlugCostcentersCostcenterid";
import type { PostOrganizationsSlugCostcentersMutationRequest } from "@/http/generated/models/PostOrganizationsSlugCostcenters";
import type { PutOrganizationsSlugCostcentersCostcenteridMutationRequest } from "@/http/generated/models/PutOrganizationsSlugCostcentersCostcenterid";
import type { CostCenter } from "@/types/registers";

export async function listCostCenters(slug: string): Promise<CostCenter[]> {
  const data = await getOrganizationsSlugCostcenters({ slug });
  return data.costCenters as CostCenter[];
}

export async function createCostCenter(slug: string, name: string): Promise<string> {
  const data = await postOrganizationsSlugCostcenters({
    slug,
    data: {
      name: name.trim(),
    } as PostOrganizationsSlugCostcentersMutationRequest,
  });
  return data.costCenterId;
}

export async function updateCostCenter(
  slug: string,
  costCenterId: string,
  name: string,
): Promise<void> {
  await putOrganizationsSlugCostcentersCostcenterid({
    slug,
    costCenterId,
    data: {
      name: name.trim(),
    } as PutOrganizationsSlugCostcentersCostcenteridMutationRequest,
  });
}

export async function deleteCostCenter(slug: string, costCenterId: string): Promise<void> {
  await deleteOrganizationsSlugCostcentersCostcenterid({ slug, costCenterId });
}
