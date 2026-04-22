import { createFileRoute } from "@tanstack/react-router";
import { Search, Trash2, MessageCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListPageSkeleton } from "@/components/loading-skeletons";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { ResponsiveDataView } from "@/components/responsive-data-view";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import { useGetOrganizationsSlugEmployees } from "@/http/generated";
import {
	getOrganizationsSlugEmployeesQueryKey,
	useDeleteOrganizationsSlugEmployeesEmployeeid,
} from "@/http/generated";
import { textFilterParser } from "@/hooks/filters/parsers";
import type { Employee } from "@/schemas/types/employee";
import { formatPhone } from "@/utils/format-phone";
import { getInitials } from "@/utils/get-initials";
import { useQueryClient } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { CreateEmployee } from "./-components/create-employee";
import { EmployeeLinkedUserBadge } from "./-components/employee-linked-user-badge";
import { UpdateEmployee } from "./-components/update-employee";

export const Route = createFileRoute("/_app/registers/employees/")({
	component: Employees,
});

type PixQrDialogState = {
	employeeName: string;
	pixKey: string;
	qrCodeDataUrl: string;
};

function buildWhatsappLink(phone: string) {
	const digits = phone.replace(/\D/g, "");

	if (!digits) {
		return null;
	}

	const normalizedPhone = digits.startsWith("55") ? digits : `55${digits}`;
	return `https://wa.me/${normalizedPhone}`;
}

function Employees() {
	const { organization } = useApp();
	const queryClient = useQueryClient();
	const [pixQrDialog, setPixQrDialog] = useState<PixQrDialogState | null>(null);
	const { mutateAsync: deleteEmployee, isPending: isDeletingEmployee } =
		useDeleteOrganizationsSlugEmployeesEmployeeid();

	const [search, setSearch] = useQueryState("q", textFilterParser);
	const { data, isLoading, isError } = useGetOrganizationsSlugEmployees({
		slug: organization!.slug,
	});

	const filteredEmployees = useMemo(() => {
		const employees = data?.employees ?? [];
		if (!search.trim()) return employees;

		const query = search.toLowerCase();

		return employees.filter((employee) => {
			return (
				employee.name.toLowerCase().includes(query) ||
				employee.email.toLowerCase().includes(query) ||
				(employee.role ?? "").toLowerCase().includes(query) ||
				(employee.department ?? "").toLowerCase().includes(query) ||
				(employee.phone ?? "").toLowerCase().includes(query)
			);
		});
	}, [data?.employees, search]);

	async function handleDeleteEmployee(employee: Employee) {
		const confirmed = window.confirm(
			`Deseja realmente excluir o funcionário ${employee.name}?`,
		);

		if (!confirmed) {
			return;
		}

		try {
			await deleteEmployee({
				slug: organization!.slug,
				employeeId: employee.id,
			});

			await queryClient.invalidateQueries({
				queryKey: getOrganizationsSlugEmployeesQueryKey({
					slug: organization!.slug,
				}),
			});

			toast.success(`Funcionário ${employee.name} excluído com sucesso.`);
		} catch (error) {
			toast.error(resolveErrorMessage(normalizeApiError(error)));
		}
	}

	function handleOpenWhatsapp(phone?: string | null) {
		if (!phone) {
			return;
		}

		const whatsappLink = buildWhatsappLink(phone);
		if (!whatsappLink) {
			return;
		}

		window.open(whatsappLink, "_blank", "noopener,noreferrer");
	}

	if (isLoading) {
		return <ListPageSkeleton actionCount={1} filterCount={1} itemCount={6} />;
	}

	if (isError) {
		return <p className="text-destructive">Erro ao carregar funcionários.</p>;
	}

	return (
		<main className="w-full space-y-6">
			<PageHeader title="Gerenciar Funcionários" actions={<CreateEmployee />} />

			<div className="relative">
				<Search className="absolute left-5 top-1/2 -translate-1/2 size-4 text-muted-foreground" />
				<Input
					placeholder="Buscar por nome, e-mail, cargo ou telefone..."
					className="h-10 w-full pl-10 sm:max-w-xl"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
			</div>

			<ResponsiveDataView
				mobile={
					<section className="space-y-3">
						{filteredEmployees.length === 0 ? (
							<Card className="p-6 text-center text-sm text-muted-foreground">
								Nenhum funcionário encontrado.
							</Card>
						) : (
							filteredEmployees.map((employee) => (
								<Card key={employee.id} className="space-y-3 p-4">
									<div className="flex items-start gap-3">
										<Avatar className="size-10">
											<AvatarImage
												src={employee.linkedUser?.avatarUrl ?? undefined}
												alt={employee.name}
											/>
											<AvatarFallback>
												{getInitials(employee.name)}
											</AvatarFallback>
										</Avatar>
										<div className="min-w-0">
											<p className="truncate text-sm font-medium">
												{employee.name}
											</p>
											<p className="text-xs text-muted-foreground">
												{employee.role || "Sem cargo"}
												{employee.department ? ` · ${employee.department}` : ""}
											</p>
										</div>
									</div>

									<div className="grid grid-cols-2 gap-2 text-xs">
										<div className="space-y-0.5">
											<p className="text-muted-foreground">E-mail</p>
											<p className="truncate">{employee.email}</p>
										</div>
										<div className="space-y-0.5">
											<p className="text-muted-foreground">Telefone</p>
											<p>
												{employee.phone
													? formatPhone(employee.phone)
													: "Sem telefone"}
											</p>
										</div>
										<div className="space-y-0.5">
											<p className="text-muted-foreground">Empresa</p>
											<p>{employee.company.name}</p>
										</div>
										<div className="space-y-0.5">
											<p className="text-muted-foreground">Unidade</p>
											<p>{employee.unit?.name ?? "Sem unidade"}</p>
										</div>
									</div>

									<div className="space-y-1.5">
										{employee.linkedUser ? (
											<EmployeeLinkedUserBadge
												linkedUser={employee.linkedUser}
											/>
										) : (
											<p className="text-xs text-muted-foreground">
												Sem acesso
											</p>
										)}
									</div>

									<div className="grid grid-cols-3 gap-2">
										<Button
											type="button"
											variant="outline"
											size="sm"
											disabled={!employee.phone}
											onClick={() => handleOpenWhatsapp(employee.phone)}
											title={
												employee.phone
													? "Abrir WhatsApp"
													: "Sem telefone cadastrado"
											}
										>
											<MessageCircle className="size-4 text-emerald-600 dark:text-emerald-300" />
											WhatsApp
										</Button>
										<UpdateEmployee employee={employee} />
										<Button
											type="button"
											variant="outline"
											size="sm"
											disabled={isDeletingEmployee}
											onClick={() => handleDeleteEmployee(employee)}
											title="Excluir funcionário"
										>
											<Trash2 className="size-4 text-red-600" />
											Excluir
										</Button>
									</div>
								</Card>
							))
						)}
					</section>
				}
				desktop={
					<section className="overflow-hidden rounded-md border bg-card">
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Funcionário</TableHead>
										<TableHead>Contato</TableHead>
										<TableHead>Vínculo</TableHead>
										<TableHead>Empresa/Unidade</TableHead>
										<TableHead className="text-center">Ações</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredEmployees.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={5}
												className="py-10 text-center text-muted-foreground"
											>
												Nenhum funcionário encontrado.
											</TableCell>
										</TableRow>
									) : (
										filteredEmployees.map((employee) => (
											<TableRow key={employee.id}>
												<TableCell>
													<div className="flex items-center gap-3">
														<Avatar className="size-10">
															<AvatarImage
																src={
																	employee.linkedUser?.avatarUrl ?? undefined
																}
																alt={employee.name}
															/>
															<AvatarFallback>
																{getInitials(employee.name)}
															</AvatarFallback>
														</Avatar>
														<div className="space-y-0.5">
															<p className="font-medium">{employee.name}</p>
															<p className="text-xs text-muted-foreground">
																{employee.role || "Sem cargo"}
																{employee.department
																	? ` · ${employee.department}`
																	: ""}
															</p>
														</div>
													</div>
												</TableCell>
												<TableCell>
													<div className="space-y-0.5">
														<p className="text-sm">{employee.email}</p>
														<p className="text-xs text-muted-foreground">
															{employee.phone
																? formatPhone(employee.phone)
																: "Sem telefone"}
														</p>
													</div>
												</TableCell>
												<TableCell>
													<div className="space-y-1.5">
														{employee.linkedUser ? (
															<EmployeeLinkedUserBadge
																linkedUser={employee.linkedUser}
															/>
														) : (
															<p className="text-xs text-muted-foreground">
																Sem acesso
															</p>
														)}
													</div>
												</TableCell>
												<TableCell>
													<div className="space-y-0.5">
														<p className="text-sm">{employee.company.name}</p>
														<p className="text-xs text-muted-foreground">
															{employee.unit?.name ?? "Sem unidade"}
														</p>
													</div>
												</TableCell>
												<TableCell>
													<div className="flex items-center justify-end gap-1">
														<Button
															type="button"
															variant="ghost"
															size="icon"
															disabled={!employee.phone}
															onClick={() => handleOpenWhatsapp(employee.phone)}
															title={
																employee.phone
																	? "Abrir WhatsApp"
																	: "Sem telefone cadastrado"
															}
														>
															<MessageCircle className="size-4 text-emerald-600 dark:text-emerald-300" />
														</Button>
														<UpdateEmployee employee={employee} />
														<Button
															type="button"
															variant="ghost"
															size="icon"
															disabled={isDeletingEmployee}
															onClick={() => handleDeleteEmployee(employee)}
															title="Excluir funcionário"
														>
															<Trash2 className="size-4 text-red-600" />
														</Button>
													</div>
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</div>
					</section>
				}
			/>

			<Dialog
				open={Boolean(pixQrDialog)}
				onOpenChange={(open) => {
					if (!open) {
						setPixQrDialog(null);
					}
				}}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>QR da chave PIX</DialogTitle>
						<DialogDescription>
							{pixQrDialog
								? `Funcionário: ${pixQrDialog.employeeName}`
								: "Chave PIX"}
						</DialogDescription>
					</DialogHeader>
					{pixQrDialog ? (
						<div className="space-y-3">
							<div className="flex justify-center rounded-md border bg-muted/20 p-4">
								<img
									src={pixQrDialog.qrCodeDataUrl}
									alt={`QR da chave PIX de ${pixQrDialog.employeeName}`}
									className="size-56"
								/>
							</div>
							<p className="break-all text-xs text-muted-foreground">
								{pixQrDialog.pixKey}
							</p>
						</div>
					) : null}
				</DialogContent>
			</Dialog>
		</main>
	);
}
