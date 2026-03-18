import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/app-context";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building, ExternalLinkIcon, MapPin, Users } from "lucide-react";

export const Route = createFileRoute("/_app/settings/organization/")({
	component: OrganizationPage,
});

function OrganizationPage() {
	const { organization } = useApp();

	return (
		<div className="mx-auto w-full max-w-4xl space-y-6">
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
				<Card className="flex flex-row gap-4 p-4 sm:p-6">
					<div className="p-3 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
						<Building />
					</div>
					<div className="flex flex-col">
						<span className="font-bold text-2xl">3</span>
						<span className="text-xs">Empresas</span>
					</div>
				</Card>
				<Card className="flex flex-row gap-4 p-4 sm:p-6">
					<div className="p-3 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
						<MapPin />
					</div>
					<div className="flex flex-col">
						<span className="font-bold text-2xl">3</span>
						<span className="text-xs">Unidades</span>
					</div>
				</Card>
				<Card className="flex flex-row gap-4 p-4 sm:p-6 sm:col-span-2 xl:col-span-1">
					<div className="p-3 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
						<Users />
					</div>
					<div className="flex flex-col">
						<span className="font-bold text-2xl">3</span>
						<span className="text-xs">Membros</span>
					</div>
				</Card>
			</div>
			<Card className="space-y-4 p-4 sm:p-6">
				<div>
					<h2 className="text-xl font-semibold sm:text-2xl">
						Dados da Organização
					</h2>
					<span className="text-xs text-muted-foreground">
						Informações da organização em que você está logado
					</span>
				</div>

				<form className="space-y-4">
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<FieldGroup>
							<Field className="gap-1">
								<FieldLabel>Nome</FieldLabel>
								<Input placeholder="" defaultValue={organization?.name ?? ""} />
							</Field>
						</FieldGroup>
						<FieldGroup>
							<Field className="gap-1">
								<FieldLabel>CNPJ</FieldLabel>
								<Input placeholder="12.345.678/0001-90" />
							</Field>
						</FieldGroup>
					</div>
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<FieldGroup>
							<Field className="gap-1">
								<FieldLabel>Email</FieldLabel>
								<Input placeholder="contato@email.com" />
							</Field>
						</FieldGroup>
						<FieldGroup>
							<Field className="gap-1">
								<FieldLabel>Telefone</FieldLabel>
								<Input placeholder="(55) 9999-0000" />
							</Field>
						</FieldGroup>
					</div>
					<FieldGroup>
						<Field className="gap-1">
							<FieldLabel>Site</FieldLabel>
							<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
								<Input placeholder="https://www.arkogrupo.com.br" />
								<Button variant="outline" className="w-full sm:w-auto" asChild>
									<Link
										to="/"
										className="inline-flex items-center justify-center gap-2"
									>
										<ExternalLinkIcon />
										Abrir
									</Link>
								</Button>
							</div>
						</Field>
					</FieldGroup>
					<FieldGroup>
						<Field className="gap-1">
							<FieldLabel>Endereço</FieldLabel>
							<Input placeholder="Duque de caxias, 2234 -  Uruguaiana/RS" />
						</Field>
					</FieldGroup>
					<Button className="w-full sm:w-auto">Salvar alterações</Button>
				</form>
			</Card>
		</div>
	);
}
