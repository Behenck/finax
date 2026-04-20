type PartnerDisplaySource = {
	name?: string | null;
	companyName?: string | null;
};

export function getPartnerDisplayName(partner: PartnerDisplaySource) {
	return partner.companyName?.trim() || partner.name?.trim() || "Parceiro";
}
