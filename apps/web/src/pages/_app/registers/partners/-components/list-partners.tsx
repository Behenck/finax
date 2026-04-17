import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { ResponsiveDataView } from "@/components/responsive-data-view";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import type { GetOrganizationsSlugPartners200 } from "@/http/generated";
import {
	getOrganizationsSlugPartnersQueryKey,
	usePutOrganizationsSlugPartnersPartnerid,
} from "@/http/generated";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
	Edit3,
	EllipsisVertical,
	Power,
	Receipt,
	UserRoundCheck,
	UserRoundX,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatPhone } from "@/utils/format-phone";
import { AssignSupervisor } from "./assign-supervisor";
import { DetailsPartner } from "./details-partner";
import { DeletePartner } from "./delete-partner";

interface ListPartnersProps {
	partners: GetOrganizationsSlugPartners200["partners"];
	emptyMessage?: string;
}

export function ListPartners({
	partners,
	emptyMessage = "Nenhum parceiro encontrado.",
}: ListPartnersProps) {
	const { organization } = useApp();
	const queryClient = useQueryClient();
	const { mutateAsync: updatePartner, isPending: isUpdatingPartner } =
		usePutOrganizationsSlugPartnersPartnerid();
	const [pendingPartnerId, setPendingPartnerId] = useState<string | null>(null);

	const supervisorPartnerCounts = partners.reduce<Record<string, number>>(
		(accumulator, currentPartner) => {
			for (const supervisor of currentPartner.supervisors) {
				accumulator[supervisor.id] = (accumulator[supervisor.id] ?? 0) + 1;
			}

			return accumulator;
		},
		{},
	);

	function renderAccessBadge(hasUser: boolean) {
		if (hasUser) {
			return (
				<Badge variant="outline" className="flex w-fit items-center gap-2">
					<UserRoundCheck className="size-3" />
					<span className="text-medium">Vinculado</span>
				</Badge>
			);
		}

		return (
			<Badge variant="outline" className="flex w-fit items-center gap-2">
				<UserRoundX className="size-3" />
				<span className="text-medium">Sem acesso</span>
			</Badge>
		);
	}

	function renderSupervisorBadges(
		supervisors: GetOrganizationsSlugPartners200["partners"][number]["supervisors"],
	) {
		if (supervisors.length === 0) {
			return <span>-</span>;
		}

		return (
			<div className="flex flex-wrap gap-1">
				{supervisors.map((supervisor) => (
					<Badge key={supervisor.id} variant="outline" className="w-fit">
						<span className="text-medium">{supervisor.name}</span>
					</Badge>
				))}
			</div>
		);
	}

	async function handleTogglePartnerStatus(
		partner: GetOrganizationsSlugPartners200["partners"][number],
	) {
		if (!organization?.slug) {
			return;
		}

		setPendingPartnerId(partner.id);

		try {
			await updatePartner({
				slug: organization.slug,
				partnerId: partner.id,
				data: {
					name: partner.name,
					email: partner.email,
					phone: partner.phone,
					companyName: partner.companyName,
					documentType: partner.documentType,
					document: partner.document,
					country: partner.country,
					state: partner.state,
					city: partner.city ?? undefined,
					street: partner.street ?? undefined,
					zipCode: partner.zipCode ?? undefined,
					neighborhood: partner.neighborhood ?? undefined,
					number: partner.number ?? undefined,
					complement: partner.complement ?? undefined,
					status: partner.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
				},
			});

			await queryClient.invalidateQueries({
				queryKey: getOrganizationsSlugPartnersQueryKey({
					slug: organization.slug,
				}),
			});

			toast.success(
				`Parceiro ${partner.name} ${partner.status === "ACTIVE" ? "inativado" : "ativado"} com sucesso!`,
			);
		} catch (error) {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		} finally {
			setPendingPartnerId(null);
		}
	}

	function isPartnerPending(partnerId: string) {
		return isUpdatingPartner && pendingPartnerId === partnerId;
	}

	return (
		<ResponsiveDataView
			mobile={
				<section className="space-y-3">
					{partners.length === 0 ? (
						<Card className="p-6 text-center text-sm text-muted-foreground">
							{emptyMessage}
						</Card>
					) : (
						partners.map((partner) => (
							<Card
								key={partner.id}
								className={cn(
									"space-y-3 p-4",
									partner.status === "INACTIVE" && "opacity-60",
								)}
							>
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0">
										<p className="truncate text-sm font-semibold">
											{partner.name}
										</p>
										<p className="truncate text-xs text-muted-foreground">
											{partner.email ?? "Sem e-mail"}
										</p>
									</div>
									<Badge
										variant={
											partner.status === "ACTIVE" ? "default" : "outline"
										}
									>
										{partner.status === "ACTIVE" ? "Ativo" : "Inativo"}
									</Badge>
								</div>

								<div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
									<div className="space-y-0.5">
										<p className="text-muted-foreground">Empresa</p>
										<p>{partner.companyName}</p>
									</div>
									<div className="space-y-0.5">
										<p className="text-muted-foreground">Contato</p>
										<p>
											{partner.phone
												? formatPhone(partner.phone)
												: "Sem telefone"}
										</p>
									</div>
									<div className="space-y-0.5">
										<p className="text-muted-foreground">Supervisores</p>
										{renderSupervisorBadges(partner.supervisors)}
									</div>
									<div className="space-y-0.5">
										<p className="text-muted-foreground">Acesso</p>
										{renderAccessBadge(Boolean(partner.user))}
									</div>
								</div>

								<div className="grid grid-cols-3 gap-2">
									<Button variant="outline" size="sm" asChild>
										<Link to="/">Ver Vendas</Link>
									</Button>

									<Button
										variant="outline"
										size="sm"
										disabled={isPartnerPending(partner.id)}
										onClick={() => void handleTogglePartnerStatus(partner)}
									>
										<Power
											className={cn(
												"size-4 text-green-600",
												partner.status === "INACTIVE" &&
													"text-muted-foreground",
											)}
										/>
										{partner.status === "ACTIVE" ? "Inativar" : "Ativar"}
									</Button>

									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button variant="outline" size="sm" className="!min-h-8">
												<EllipsisVertical className="size-4" />
												Ações
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuGroup className="space-y-1">
												<DetailsPartner partner={partner} />
												<DropdownMenuItem asChild>
													<Link
														to="/registers/partners/update"
														search={{ partnerId: partner.id }}
														className="cursor-pointer"
													>
														<div className="flex gap-4 items-center">
															<Edit3 className="size-3.5 text-foreground" />
															<span className="font-light text-sm">Editar</span>
														</div>
													</Link>
												</DropdownMenuItem>
												<DropdownMenuItem asChild>
													<Link to="/" className="cursor-pointer">
														<div className="flex gap-4 items-center">
															<Receipt className="size-3.5 text-foreground" />
															<span className="font-light text-sm">
																Ver Vendas
															</span>
														</div>
													</Link>
												</DropdownMenuItem>
												<AssignSupervisor
													partner={partner}
													supervisorPartnerCounts={supervisorPartnerCounts}
												/>
												<Separator />
												<DeletePartner partner={partner} />
											</DropdownMenuGroup>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
							</Card>
						))
					)}
				</section>
			}
			desktop={
				<Table>
					<TableCaption>Lista de parceiros</TableCaption>
					<TableHeader>
						<TableRow>
							<TableHead>Parceiro</TableHead>
							<TableHead>Empresa</TableHead>
							<TableHead>Supervisores</TableHead>
							<TableHead>Acesso</TableHead>
							<TableHead>Vendas</TableHead>
							<TableHead>Status</TableHead>
							<TableHead className="text-right"></TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{partners.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={7}
									className="py-10 text-center text-muted-foreground"
								>
									{emptyMessage}
								</TableCell>
							</TableRow>
						) : (
							partners.map((partner) => {
								return (
									<TableRow
										key={partner.id}
										className={cn(
											partner.status === "INACTIVE" && "opacity-60",
										)}
									>
										<TableCell>
											<div className="flex flex-col">
												<span className="font-semibold">{partner.name}</span>
												<span className="text-xs text-muted-foreground">
													{partner.email}
												</span>
											</div>
										</TableCell>
										<TableCell>{partner.companyName}</TableCell>
										<TableCell>
											{renderSupervisorBadges(partner.supervisors)}
										</TableCell>
										<TableCell>
											{renderAccessBadge(Boolean(partner.user))}
										</TableCell>
										<TableCell>
											<span className="text-medium text-green-600">
												R$ 0,00
											</span>
										</TableCell>
										<TableCell>
											<Badge
												variant={
													partner.status === "ACTIVE" ? "default" : "outline"
												}
											>
												{partner.status === "ACTIVE" ? "Ativo" : "Inativo"}
											</Badge>
										</TableCell>
										<TableCell>
											<div className="flex justify-end gap-1">
												<Button
													variant="ghost"
													size="icon"
													disabled={isPartnerPending(partner.id)}
													aria-label={
														partner.status === "ACTIVE"
															? "Inativar parceiro"
															: "Ativar parceiro"
													}
													title={
														partner.status === "ACTIVE"
															? "Inativar parceiro"
															: "Ativar parceiro"
													}
													onClick={() =>
														void handleTogglePartnerStatus(partner)
													}
												>
													<Power
														className={cn(
															"size-4 text-green-600",
															partner.status === "INACTIVE" &&
																"text-muted-foreground",
														)}
													/>
												</Button>

												<DropdownMenu>
													<DropdownMenuTrigger asChild>
														<Button variant="ghost">
															<EllipsisVertical className="size-4 text-muted-foreground" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent className="mr-4">
														<DropdownMenuGroup className="space-y-1">
															<DetailsPartner partner={partner} />
															<DropdownMenuItem asChild>
																<Link
																	to="/registers/partners/update"
																	search={{ partnerId: partner.id }}
																	className="cursor-pointer"
																>
																	<div className="flex gap-4 items-center">
																		<Edit3 className="size-3.5 text-foreground" />
																		<span className="font-light text-sm">
																			Editar
																		</span>
																	</div>
																</Link>
															</DropdownMenuItem>
															<DropdownMenuItem asChild>
																<Link to="/" className="cursor-pointer">
																	<div className="flex gap-4 items-center">
																		<Receipt className="size-3.5 text-foreground" />
																		<span className="font-light text-sm">
																			Ver Vendas
																		</span>
																	</div>
																</Link>
															</DropdownMenuItem>
															<AssignSupervisor
																partner={partner}
																supervisorPartnerCounts={
																	supervisorPartnerCounts
																}
															/>
															<Separator />
															<DeletePartner partner={partner} />
														</DropdownMenuGroup>
													</DropdownMenuContent>
												</DropdownMenu>
											</div>
										</TableCell>
									</TableRow>
								);
							})
						)}
					</TableBody>
				</Table>
			}
		/>
	);
}
