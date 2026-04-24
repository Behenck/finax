import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	getOrganizationSlugQueryKey,
	useGetOrganizationSlug,
	usePutOrganizationSlug,
} from "@/http/generated";
import { useApp } from "@/context/app-context";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings/")({
	component: RouteComponent,
});

function parsePreCancellationThresholdInput(value: string) {
	const normalizedValue = value.trim();

	if (!normalizedValue) {
		return null;
	}

	const parsedValue = Number(normalizedValue);

	if (!Number.isInteger(parsedValue) || parsedValue < 1) {
		throw new Error(
			"Informe um número inteiro maior ou igual a 1 para ativar o pré-cancelamento.",
		);
	}

	return parsedValue;
}

export function RouteComponent() {
	const queryClient = useQueryClient();
	const { organization } = useApp();
	const slug = organization?.slug;

	const { data } = useGetOrganizationSlug(
		{ slug: slug ?? "" },
		{
			query: {
				enabled: Boolean(slug),
			},
		},
	);

	const { mutateAsync: updateOrganization, isPending: isUpdatingOrganization } =
		usePutOrganizationSlug();

	const currentSyncValue = useMemo(() => {
		return (
			data?.organization.enableSalesTransactionsSync ??
			organization?.enableSalesTransactionsSync ??
			false
		);
	}, [
		data?.organization.enableSalesTransactionsSync,
		organization?.enableSalesTransactionsSync,
	]);
	const currentPreCancellationThresholdValue = useMemo(() => {
		const threshold =
			data?.organization.preCancellationDelinquencyThreshold ??
			organization?.preCancellationDelinquencyThreshold ??
			null;

		return threshold === null ? "" : String(threshold);
	}, [
		data?.organization.preCancellationDelinquencyThreshold,
		organization?.preCancellationDelinquencyThreshold,
	]);

	const [enableSalesTransactionsSync, setEnableSalesTransactionsSync] =
		useState(currentSyncValue);
	const [
		preCancellationDelinquencyThresholdInput,
		setPreCancellationDelinquencyThresholdInput,
	] = useState(currentPreCancellationThresholdValue);

	useEffect(() => {
		setEnableSalesTransactionsSync(currentSyncValue);
	}, [currentSyncValue]);

	useEffect(() => {
		setPreCancellationDelinquencyThresholdInput(
			currentPreCancellationThresholdValue,
		);
	}, [currentPreCancellationThresholdValue]);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (!slug) {
			toast.error("Organização não encontrada.");
			return;
		}

		const organizationPayload = data?.organization;

		const name = organizationPayload?.name ?? organization?.name;

		if (!name) {
			toast.error("Não foi possível identificar o nome da organização.");
			return;
		}

		try {
			const preCancellationDelinquencyThreshold =
				parsePreCancellationThresholdInput(
					preCancellationDelinquencyThresholdInput,
				);

			await updateOrganization({
				slug,
				data: {
					name,
					domain: organizationPayload?.domain ?? null,
					shouldAttachUserByDomain:
						organizationPayload?.shouldAttachUserByDomain ?? false,
					enableSalesTransactionsSync,
					preCancellationDelinquencyThreshold,
				},
			});

			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: getOrganizationSlugQueryKey({ slug }),
				}),
				queryClient.invalidateQueries({
					queryKey: ["session"],
				}),
			]);

			toast.success("Preferências salvas com sucesso.");
		} catch (error) {
			toast.error(resolveErrorMessage(normalizeApiError(error)));
		}
	}

	return (
		<Card className="mx-auto w-full max-w-3xl gap-6 p-4 sm:p-6">
			<div>
				<h2 className="text-xl font-bold sm:text-2xl">Preferências Gerais</h2>
				<span className="text-muted-foreground text-xs">
					Configure as preferências gerais do sistema
				</span>
			</div>

			<form className="space-y-6" onSubmit={handleSubmit}>
				<FieldGroup>
					<Field className="gap-1">
						<FieldLabel>Nome do Sistema</FieldLabel>
						<Input placeholder="Finax" />
					</Field>
				</FieldGroup>
				<FieldGroup>
					<Field className="gap-1">
						<FieldLabel>Pré-cancelamento por inadimplência</FieldLabel>
						<Input
							type="number"
							inputMode="numeric"
							min={1}
							placeholder="Deixe vazio para desativar"
							value={preCancellationDelinquencyThresholdInput}
							onChange={(event) =>
								setPreCancellationDelinquencyThresholdInput(
									event.target.value,
								)
							}
							disabled={!slug || isUpdatingOrganization}
						/>
						<span className="text-sm text-muted-foreground">
							A venda entra em pré-cancelamento quando atinge este número de
							inadimplências abertas.
						</span>
					</Field>
				</FieldGroup>
				<FieldGroup>
					<Field className="gap-1">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<FieldLabel className="text-md">
									Notificações por e-mail
								</FieldLabel>
								<span className="text-sm text-muted-foreground">
									Receber notificações de atividades importantes
								</span>
							</div>
							<Switch />
						</div>
					</Field>
				</FieldGroup>
				<FieldGroup>
					<Field className="gap-1">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<FieldLabel className="text-md">Modo escuro</FieldLabel>
								<span className="text-sm text-muted-foreground">
									Alternar entre tema claro e escuro
								</span>
							</div>
							<Switch />
						</div>
					</Field>
				</FieldGroup>
				<FieldGroup>
					<Field className="gap-1">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<FieldLabel className="text-md">
									Sincronizar vendas com transações
								</FieldLabel>
								<span className="text-sm text-muted-foreground">
									Cria e mantém receitas financeiras vinculadas às vendas
									concluídas.
								</span>
							</div>
							<Switch
								checked={enableSalesTransactionsSync}
								onCheckedChange={setEnableSalesTransactionsSync}
								disabled={!slug || isUpdatingOrganization}
							/>
						</div>
					</Field>
				</FieldGroup>

				<Button
					className="w-full sm:w-auto"
					type="submit"
					disabled={!slug || isUpdatingOrganization}
				>
					{isUpdatingOrganization ? "Salvando..." : "Salvar Preferências"}
				</Button>
			</form>
		</Card>
	);
}
