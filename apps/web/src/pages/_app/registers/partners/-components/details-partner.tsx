import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
	BookUser,
	Building2,
	ListChevronsUpDown,
	Mail,
	Percent,
	Phone,
	TrendingUp,
} from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { type GetOrganizationsSlugPartnersPartnerid200 } from "@/http/generated";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/utils/get-initials";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatPhone } from "@/utils/format-phone";
import { formatDocument } from "@/utils/format-document";
import { Card } from "@/components/ui/card";

interface DetailsPartnerProps {
	partner: GetOrganizationsSlugPartnersPartnerid200["partner"];
}

export function DetailsPartner({ partner }: DetailsPartnerProps) {
	return (
		<Dialog>
			<DialogTrigger>
				<DropdownMenuItem onSelect={(e) => e.preventDefault()}>
					<div className="flex gap-4 items-center">
						<ListChevronsUpDown className="size-3.5 text-foreground" />
						<span className="font-light text-sm">Ver Detalhes</span>
					</div>
				</DropdownMenuItem>
			</DialogTrigger>
			<DialogContent className="space-y-2">
				<DialogHeader>
					<DialogTitle>Detalhes do Parceiro</DialogTitle>
				</DialogHeader>
				<div className="flex gap-4">
					<Avatar className="rounded-md! w-full h-full max-w-24">
						<AvatarImage src="" />
						<AvatarFallback className="rounded-md!">
							{getInitials(partner.name)}
						</AvatarFallback>
					</Avatar>
					<div className="flex flex-col gap-1 flex-1">
						<h2 className="font-bold text-xl">{partner.name}</h2>
						<span>{partner.companyName}</span>
						<Badge>{partner.status === "ACTIVE" ? "Ativo" : "Inativo"}</Badge>
					</div>
				</div>
				<Separator />
				<div className="flex flex-col gap-2">
					<h3 className="font-normal mb-2 uppercase">Contato</h3>
					{partner.email && (
						<div className="flex items-center gap-2">
							<Mail className="size-4" />
							<span className="text-sm font-light">{partner.email}</span>
						</div>
					)}
					{partner.phone && (
						<div className="flex items-center gap-2">
							<Phone className="size-4" />
							<span className="text-sm font-light">
								{formatPhone(partner.phone)}
							</span>
						</div>
					)}
					{partner.companyName && (
						<div className="flex items-center gap-2">
							<Building2 className="size-4" />
							<span className="text-sm font-light">{partner.companyName}</span>
						</div>
					)}
					{partner.document && (
						<div className="flex items-center gap-2">
							<BookUser className="size-4" />
							<span className="text-sm font-light">
								{formatDocument({
									type: partner.documentType,
									value: partner.document,
								})}
							</span>
						</div>
					)}
				</div>
				<Separator />
				<div className="flex flex-col gap-2">
					<h3 className="font-normal mb-2 uppercase">Desempenho</h3>
					<div className="flex gap-4">
						<Card className="p-3 w-full gap-2">
							<header className="flex gap-2">
								<TrendingUp className="size-4" />
								<span className="font-light text-xs">Vendas</span>
							</header>
							<span className="font-bold text-2xl">0</span>
						</Card>
						<Card className="p-3 w-full gap-2">
							<header className="flex gap-2">
								<Percent className="size-4" />
								<span className="font-light text-xs">Comissão</span>
							</header>
							<span className="font-bold text-2xl text-green-600">R$ 0,00</span>
						</Card>
					</div>
				</div>
				{partner.supervisors.length > 0 && (
					<>
						<Separator />
						<div className="flex flex-col gap-2">
							<h3 className="font-normal mb-2 uppercase">Supervisores</h3>
							<div className="flex flex-wrap gap-1">
								{partner.supervisors.map((supervisor) => (
									<Badge key={supervisor.id} variant="outline">
										{supervisor.name}
									</Badge>
								))}
							</div>
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
