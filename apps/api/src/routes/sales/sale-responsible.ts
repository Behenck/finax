import { prisma } from "@/lib/prisma";
import { getPartnerDisplayName } from "@/utils/partner-display";
import { PartnerStatus, Role, SellerStatus } from "generated/prisma/enums";
import { BadRequestError } from "../_errors/bad-request-error";
import type { SaleResponsibleInput } from "./sale-schemas";

type SaleResponsiblePayload =
  | { type: "COMPANY"; id: string; name: string }
  | { type: "UNIT"; id: string; name: string }
  | { type: "SELLER"; id: string; name: string }
  | { type: "PARTNER"; id: string; name: string }
  | { type: "SUPERVISOR"; id: string; name: string }
  | { type: "OTHER"; id: null; name: string };

type SaleResponsibleLookupInput = {
  id: string;
  responsibleType?: string | null;
  responsibleId?: string | null;
  responsibleLabel?: string | null;
};

type ResolveSaleResponsibleOptions = {
  allowInactivePartner?: boolean;
};

export async function resolveSaleResponsibleData(
  organizationId: string,
  responsible: SaleResponsibleInput,
  options: ResolveSaleResponsibleOptions = {},
) {
  if (responsible.type === "COMPANY") {
    if (!responsible.id) {
      throw new BadRequestError("Company responsible id is required");
    }

    const company = await prisma.company.findFirst({
      where: { id: responsible.id, organizationId },
      select: { id: true },
    });

    if (!company) {
      throw new BadRequestError("Company responsible not found");
    }

    return {
      responsibleType: "COMPANY" as const,
      responsibleId: company.id,
      responsibleLabel: null,
    };
  }

  if (responsible.type === "UNIT") {
    if (!responsible.id) {
      throw new BadRequestError("Unit responsible id is required");
    }

    const unit = await prisma.unit.findFirst({
      where: { id: responsible.id, company: { organizationId } },
      select: { id: true },
    });

    if (!unit) {
      throw new BadRequestError("Unit responsible not found");
    }

    return {
      responsibleType: "UNIT" as const,
      responsibleId: unit.id,
      responsibleLabel: null,
    };
  }

  if (responsible.type === "SELLER") {
    if (!responsible.id) {
      throw new BadRequestError("Seller responsible id is required");
    }

    const seller = await prisma.seller.findFirst({
      where: {
        id: responsible.id,
        organizationId,
        status: SellerStatus.ACTIVE,
      },
      select: {
        id: true,
      },
    });

    if (!seller) {
      throw new BadRequestError("Seller not found or inactive");
    }

    return {
      responsibleType: "SELLER" as const,
      responsibleId: seller.id,
      responsibleLabel: null,
    };
  }

  if (responsible.type === "PARTNER") {
    if (!responsible.id) {
      throw new BadRequestError("Partner responsible id is required");
    }

    const partner = await prisma.partner.findFirst({
      where: {
        id: responsible.id,
        organizationId,
        ...(options.allowInactivePartner
          ? {}
          : {
              status: PartnerStatus.ACTIVE,
            }),
      },
      select: {
        id: true,
      },
    });

    if (!partner) {
      throw new BadRequestError(
        options.allowInactivePartner
          ? "Partner not found"
          : "Partner not found or inactive",
      );
    }

    return {
      responsibleType: "PARTNER" as const,
      responsibleId: partner.id,
      responsibleLabel: null,
    };
  }

  if (responsible.type === "SUPERVISOR") {
    if (!responsible.id) {
      throw new BadRequestError("Supervisor responsible id is required");
    }

    const supervisor = await prisma.member.findFirst({
      where: {
        id: responsible.id,
        organizationId,
        role: Role.SUPERVISOR,
      },
      select: { id: true },
    });

    if (!supervisor) {
      throw new BadRequestError("Supervisor responsible not found");
    }

    return {
      responsibleType: "SUPERVISOR" as const,
      responsibleId: supervisor.id,
      responsibleLabel: null,
    };
  }

  if (!responsible.label) {
    throw new BadRequestError("Other responsible label is required");
  }

  return {
    responsibleType: "OTHER" as const,
    responsibleId: null,
    responsibleLabel: responsible.label,
  };
}

export async function loadSaleResponsible(
  organizationId: string,
  sale: Omit<SaleResponsibleLookupInput, "id">,
) {
  if (sale.responsibleType === "SELLER" && sale.responsibleId) {
    const seller = await prisma.seller.findFirst({
      where: {
        id: sale.responsibleId,
        organizationId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!seller) {
      return null;
    }

    return {
      type: "SELLER" as const,
      id: seller.id,
      name: seller.name,
    };
  }

  if (sale.responsibleType === "COMPANY" && sale.responsibleId) {
    const company = await prisma.company.findFirst({
      where: {
        id: sale.responsibleId,
        organizationId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!company) {
      return null;
    }

    return {
      type: "COMPANY" as const,
      id: company.id,
      name: company.name,
    };
  }

  if (sale.responsibleType === "UNIT" && sale.responsibleId) {
    const unit = await prisma.unit.findFirst({
      where: {
        id: sale.responsibleId,
        company: { organizationId },
      },
      select: {
        id: true,
        name: true,
        company: { select: { name: true } },
      },
    });

    if (!unit) {
      return null;
    }

    return {
      type: "UNIT" as const,
      id: unit.id,
      name: `${unit.company.name} -> ${unit.name}`,
    };
  }

  if (sale.responsibleType === "PARTNER" && sale.responsibleId) {
    const partner = await prisma.partner.findFirst({
      where: {
        id: sale.responsibleId,
        organizationId,
      },
      select: {
        id: true,
        name: true,
        companyName: true,
      },
    });

    if (!partner) {
      return null;
    }

    return {
      type: "PARTNER" as const,
      id: partner.id,
      name: getPartnerDisplayName(partner),
    };
  }

  if (sale.responsibleType === "SUPERVISOR" && sale.responsibleId) {
    const supervisor = await prisma.member.findFirst({
      where: {
        id: sale.responsibleId,
        organizationId,
        role: Role.SUPERVISOR,
      },
      select: {
        id: true,
        user: { select: { name: true, email: true } },
      },
    });

    if (!supervisor) {
      return null;
    }

    return {
      type: "SUPERVISOR" as const,
      id: supervisor.id,
      name: supervisor.user.name ?? supervisor.user.email,
    };
  }

  if (sale.responsibleType === "OTHER" && sale.responsibleLabel) {
    return {
      type: "OTHER" as const,
      id: null,
      name: sale.responsibleLabel,
    };
  }

  return null;
}

export async function loadSalesResponsible(
  organizationId: string,
  sales: SaleResponsibleLookupInput[],
) {
  const collectIds = (type: SaleResponsibleLookupInput["responsibleType"]) =>
    Array.from(
      new Set(
        sales
          .filter(
            (sale) => sale.responsibleType === type && !!sale.responsibleId,
          )
          .map((sale) => sale.responsibleId as string),
      ),
    );

  const companyIds = collectIds("COMPANY");
  const unitIds = collectIds("UNIT");
  const sellerIds = collectIds("SELLER");
  const partnerIds = collectIds("PARTNER");
  const supervisorIds = collectIds("SUPERVISOR");

  const [companies, units, sellers, partners, supervisors] = await Promise.all([
    companyIds.length
      ? prisma.company.findMany({
          where: {
            organizationId,
            id: {
              in: companyIds,
            },
          },
          select: {
            id: true,
            name: true,
          },
        })
      : Promise.resolve([]),
    unitIds.length
      ? prisma.unit.findMany({
          where: {
            id: {
              in: unitIds,
            },
            company: { organizationId },
          },
          select: {
            id: true,
            name: true,
            company: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    sellerIds.length
      ? prisma.seller.findMany({
          where: {
            organizationId,
            id: {
              in: sellerIds,
            },
          },
          select: {
            id: true,
            name: true,
          },
        })
      : Promise.resolve([]),
    partnerIds.length
      ? prisma.partner.findMany({
          where: {
            organizationId,
            id: {
              in: partnerIds,
            },
          },
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        })
      : Promise.resolve([]),
    supervisorIds.length
      ? prisma.member.findMany({
          where: {
            organizationId,
            role: Role.SUPERVISOR,
            id: {
              in: supervisorIds,
            },
          },
          select: {
            id: true,
            user: { select: { name: true, email: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const companiesById = new Map(
    companies.map((company) => [company.id, company]),
  );
  const unitsById = new Map(units.map((unit) => [unit.id, unit]));
  const sellersById = new Map(sellers.map((seller) => [seller.id, seller]));
  const partnersById = new Map(
    partners.map((partner) => [partner.id, partner]),
  );
  const supervisorsById = new Map(
    supervisors.map((supervisor) => [supervisor.id, supervisor]),
  );

  const entries: Array<[string, SaleResponsiblePayload | null]> = sales.map(
    (sale) => {
      if (sale.responsibleType === "COMPANY" && sale.responsibleId) {
        const company = companiesById.get(sale.responsibleId);
        return [
          sale.id,
          company
            ? ({ type: "COMPANY", id: company.id, name: company.name } as const)
            : null,
        ];
      }

      if (sale.responsibleType === "UNIT" && sale.responsibleId) {
        const unit = unitsById.get(sale.responsibleId);
        return [
          sale.id,
          unit
            ? ({
                type: "UNIT",
                id: unit.id,
                name: `${unit.company.name} -> ${unit.name}`,
              } as const)
            : null,
        ];
      }

      if (sale.responsibleType === "SELLER" && sale.responsibleId) {
        const seller = sellersById.get(sale.responsibleId);
        return [
          sale.id,
          seller
            ? ({ type: "SELLER", id: seller.id, name: seller.name } as const)
            : null,
        ];
      }

      if (sale.responsibleType === "PARTNER" && sale.responsibleId) {
        const partner = partnersById.get(sale.responsibleId);
        return [
          sale.id,
          partner
            ? ({
                type: "PARTNER",
                id: partner.id,
                name: getPartnerDisplayName(partner),
              } as const)
            : null,
        ];
      }

      if (sale.responsibleType === "SUPERVISOR" && sale.responsibleId) {
        const supervisor = supervisorsById.get(sale.responsibleId);
        return [
          sale.id,
          supervisor
            ? ({
                type: "SUPERVISOR",
                id: supervisor.id,
                name: supervisor.user.name ?? supervisor.user.email,
              } as const)
            : null,
        ];
      }

      if (sale.responsibleType === "OTHER" && sale.responsibleLabel) {
        return [
          sale.id,
          { type: "OTHER", id: null, name: sale.responsibleLabel } as const,
        ];
      }

      return [sale.id, null];
    },
  );

  return new Map<string, SaleResponsiblePayload | null>(entries);
}
