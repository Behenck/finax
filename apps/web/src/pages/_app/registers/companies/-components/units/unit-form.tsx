import { Button } from "@/components/ui/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import type z from "zod";
import { formatTitleCase } from "@/utils/format-title-case";
import { formatDocument } from "@/utils/format-document";
import type { Unit } from "@/schemas/types/unit";
import { unitSchema, type UnitFormData } from "@/schemas/unity-schema";
import { useApp } from "@/context/app-context";
import { useQueryClient } from "@tanstack/react-query";
import {
	getOrganizationsSlugCompaniesQueryKey,
	usePostOrganizationsSlugCompaniesCompanyidUnits,
	usePutOrganizationsSlugCompaniesCompanyidUnitsUnitid,
} from "@/http/generated";
import { useCallback, useEffect, useRef, useState } from "react";
import { LocateFixed } from "lucide-react";
import { toast } from "sonner";

export type CreateUnitType = z.infer<typeof unitSchema>;

interface CreateUnitFormProps {
	onSuccess?: () => void;
	mode?: "create" | "edit";
	companyId: string;
	initialData?: Unit;
}

type ViaCepResponse = {
	cep?: string;
	logradouro?: string;
	complemento?: string;
	bairro?: string;
	localidade?: string;
	uf?: string;
	erro?: boolean;
};

type NominatimReverseResponse = {
	address?: {
		city?: string;
		town?: string;
		village?: string;
		municipality?: string;
		state?: string;
		state_code?: string;
		country_code?: string;
		postcode?: string;
		road?: string;
		pedestrian?: string;
		residential?: string;
		neighbourhood?: string;
		suburb?: string;
		city_district?: string;
		house_number?: string;
	};
};

const BRAZIL_STATE_CODES_BY_NAME: Record<string, string> = {
	acre: "AC",
	alagoas: "AL",
	"amapa": "AP",
	amazonas: "AM",
	bahia: "BA",
	ceara: "CE",
	"distrito federal": "DF",
	"espirito santo": "ES",
	goias: "GO",
	maranhao: "MA",
	"mato grosso": "MT",
	"mato grosso do sul": "MS",
	"minas gerais": "MG",
	para: "PA",
	"paraiba": "PB",
	parana: "PR",
	pernambuco: "PE",
	piaui: "PI",
	"rio de janeiro": "RJ",
	"rio grande do norte": "RN",
	"rio grande do sul": "RS",
	rondonia: "RO",
	roraima: "RR",
	"santa catarina": "SC",
	"sao paulo": "SP",
	sergipe: "SE",
	tocantins: "TO",
};

function formatZipCode(value: string) {
	const digits = value.replace(/\D/g, "").slice(0, 8);

	if (digits.length <= 5) return digits;

	return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function resolveStateCode(rawState?: string, rawStateCode?: string) {
	if (rawStateCode) {
		const parsed = rawStateCode.toUpperCase().replace("BR-", "").trim();
		if (parsed.length === 2) {
			return parsed;
		}
	}

	if (!rawState) {
		return "";
	}

	const normalizedStateName = rawState
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.trim();

	return BRAZIL_STATE_CODES_BY_NAME[normalizedStateName] ?? rawState;
}

export function UnitForm({
	onSuccess,
	mode,
	companyId,
	initialData,
}: CreateUnitFormProps) {
	const { organization } = useApp();
	const queryClient = useQueryClient();
	const [isResolvingCurrentLocation, setIsResolvingCurrentLocation] =
		useState(false);
	const skipZipCodeAutoResolveRef = useRef(false);

	const { mutateAsync: createUnit } =
		usePostOrganizationsSlugCompaniesCompanyidUnits();
	const { mutateAsync: updateUnit } =
		usePutOrganizationsSlugCompaniesCompanyidUnitsUnitid();

	const { handleSubmit, control, setValue, getValues } = useForm<CreateUnitType>({
		resolver: zodResolver(unitSchema),
		defaultValues: {
			name: initialData?.name ?? "",
			cnpj: initialData?.cnpj ?? "",
			country: initialData?.country ?? "",
			state: initialData?.state ?? "",
			city: initialData?.city ?? "",
			street: initialData?.street ?? "",
			zipCode: initialData?.zipCode ?? "",
			neighborhood: initialData?.neighborhood ?? "",
			number: initialData?.number ?? "",
			complement: initialData?.complement ?? "",
		},
	});

	const zipCode = useWatch({ control, name: "zipCode" });

	const fillAddressFromZipCode = useCallback(
		async (digits: string, signal?: AbortSignal) => {
			try {
				const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
					signal,
				});

				if (!response.ok) {
					return;
				}

				const data = (await response.json()) as ViaCepResponse;
				if (data.erro) {
					return;
				}

				setValue("street", data.logradouro ?? "");
				setValue("neighborhood", data.bairro ?? "");
				setValue("city", data.localidade ?? "");
				setValue("state", data.uf ?? "");
				setValue("country", "BR");
				if (data.complemento) {
					setValue("complement", data.complemento);
				}
			} catch (error) {
				if (error instanceof DOMException && error.name === "AbortError") {
					return;
				}
			}
		},
		[setValue],
	);

	useEffect(() => {
		const digits = (zipCode ?? "").replace(/\D/g, "");

		if (digits.length !== 8) {
			skipZipCodeAutoResolveRef.current = false;
			return;
		}
		if (skipZipCodeAutoResolveRef.current) {
			skipZipCodeAutoResolveRef.current = false;
			return;
		}

		const abortController = new AbortController();
		void fillAddressFromZipCode(digits, abortController.signal);

		return () => {
			abortController.abort();
		};
	}, [fillAddressFromZipCode, zipCode]);

	async function handleUseCurrentLocation() {
		if (!navigator?.geolocation) {
			toast.error("Seu navegador não suporta geolocalização.");
			return;
		}

		setIsResolvingCurrentLocation(true);

		try {
			const position = await new Promise<GeolocationPosition>((resolve, reject) => {
				navigator.geolocation.getCurrentPosition(resolve, reject, {
					enableHighAccuracy: true,
					timeout: 10000,
					maximumAge: 0,
				});
			});

			const response = await fetch(
				`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${position.coords.latitude}&lon=${position.coords.longitude}&addressdetails=1&accept-language=pt-BR`,
			);
			if (!response.ok) {
				throw new Error("Erro ao buscar localização");
			}

			const data = (await response.json()) as NominatimReverseResponse;
			const city =
				data.address?.city ??
				data.address?.town ??
				data.address?.village ??
				data.address?.municipality ??
				"";
			const state = resolveStateCode(
				data.address?.state,
				data.address?.state_code,
			);
			const zipCodeDigits = (data.address?.postcode ?? "")
				.replace(/\D/g, "")
				.slice(0, 8);
			const streetFromGeo =
				data.address?.road ??
				data.address?.pedestrian ??
				data.address?.residential ??
				"";
			const neighborhoodFromGeo =
				data.address?.suburb ??
				data.address?.neighbourhood ??
				data.address?.city_district ??
				"";
			const numberFromGeo = data.address?.house_number ?? "";

			if (
				!city &&
				!state &&
				!zipCodeDigits &&
				!streetFromGeo &&
				!neighborhoodFromGeo
			) {
				toast.error(
					"Não foi possível identificar dados úteis da sua localização.",
				);
				return;
			}

			if (city) {
				setValue("city", formatTitleCase(city));
			}
			if (state) {
				setValue("state", state);
			}
			if (!getValues("country")) {
				setValue("country", "BR");
			}
			if (streetFromGeo) {
				setValue("street", formatTitleCase(streetFromGeo));
			}
			if (neighborhoodFromGeo) {
				setValue("neighborhood", formatTitleCase(neighborhoodFromGeo));
			}
			if (numberFromGeo) {
				setValue("number", numberFromGeo);
			}
			if (zipCodeDigits) {
				setValue("zipCode", formatZipCode(zipCodeDigits));
				if (zipCodeDigits.length === 8) {
					skipZipCodeAutoResolveRef.current = true;
					await fillAddressFromZipCode(zipCodeDigits);
				}
			}

			toast.success("Dados de localização preenchidos com sua localização atual.");
		} catch {
			toast.error(
				"Não foi possível usar sua localização atual. Você pode preencher manualmente.",
			);
		} finally {
			setIsResolvingCurrentLocation(false);
		}
	}

	async function onSubmit(data: UnitFormData) {
		if (mode === "edit" && initialData) {
			await updateUnit(
				{
					slug: organization!.slug,
					companyId,
					unitId: initialData.id,
					data,
				},
				{
					onSuccess: async () => {
						await queryClient.invalidateQueries({
							queryKey: getOrganizationsSlugCompaniesQueryKey({
								slug: organization!.slug,
							}),
						});
					},
				},
			);
		} else {
			await createUnit(
				{
					slug: organization!.slug,
					companyId,
					data,
				},
				{
					onSuccess: async () => {
						await queryClient.invalidateQueries({
							queryKey: getOrganizationsSlugCompaniesQueryKey({
								slug: organization!.slug,
							}),
						});
					},
				},
			);
		}

		onSuccess?.();
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
			<div className="grid grid-cols-1 gap-3">
				<FieldGroup className="w-full">
					<Controller
						name="name"
						control={control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid} className="gap-1 w-full">
								<FieldLabel htmlFor="name">Nome</FieldLabel>
								<Input
									{...field}
									id="name"
									value={field.value ?? ""}
									type="text"
									autoCapitalize="none"
									autoCorrect="off"
									aria-invalid={fieldState.invalid}
									aria-describedby={
										fieldState.invalid ? "name-error" : undefined
									}
									className="w-full"
									placeholder="Digite o nome da unidade"
									onChange={(event) => {
										const formattedValue = formatTitleCase(event.target.value);
										field.onChange(formattedValue);
									}}
								/>
								{fieldState.invalid && (
									<FieldError id="name-error" errors={[fieldState.error]} />
								)}
							</Field>
						)}
					/>
					<Controller
						name="cnpj"
						control={control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid} className="gap-1 w-full">
								<FieldLabel htmlFor="cnpj">CNPJ</FieldLabel>
								<Input
									{...field}
									id="cnpj"
									value={field.value ?? ""}
									type="text"
									autoCapitalize="none"
									autoCorrect="off"
									aria-invalid={fieldState.invalid}
									aria-describedby={
										fieldState.invalid ? "cnpj-error" : undefined
									}
									className="w-full"
									placeholder="00.000.000/0000-00"
									onChange={(event) => {
										field.onChange(
											formatDocument({
												type: "CNPJ",
												value: event.target.value,
											}),
										);
									}}
								/>
								{fieldState.invalid && (
									<FieldError id="cnpj-error" errors={[fieldState.error]} />
								)}
							</Field>
						)}
					/>
				</FieldGroup>
			</div>

			<section className="space-y-3">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h3 className="text-sm font-medium text-muted-foreground">Localização</h3>
					<Button
						type="button"
						variant="outline"
						onClick={() => void handleUseCurrentLocation()}
						disabled={isResolvingCurrentLocation}
					>
						<LocateFixed className="size-4" />
						{isResolvingCurrentLocation
							? "Obtendo localização..."
							: "Usar localização atual"}
					</Button>
				</div>

				<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
					<FieldGroup>
						<Controller
							name="zipCode"
							control={control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid} className="gap-1">
									<FieldLabel htmlFor="zipCode">CEP</FieldLabel>
									<Input
										{...field}
										id="zipCode"
										value={field.value ?? ""}
										placeholder="00000-000"
										onChange={(event) => {
											field.onChange(formatZipCode(event.target.value));
										}}
									/>
									{fieldState.invalid && (
										<FieldError id="zipCode-error" errors={[fieldState.error]} />
									)}
								</Field>
							)}
						/>
					</FieldGroup>
					<FieldGroup>
						<Controller
							name="country"
							control={control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid} className="gap-1">
									<FieldLabel htmlFor="country">País</FieldLabel>
									<Input
										{...field}
										id="country"
										value={field.value ?? ""}
										placeholder="Ex: BR"
										onChange={(event) => {
											field.onChange(event.target.value.toUpperCase());
										}}
									/>
									{fieldState.invalid && (
										<FieldError id="country-error" errors={[fieldState.error]} />
									)}
								</Field>
							)}
						/>
					</FieldGroup>
					<FieldGroup>
						<Controller
							name="state"
							control={control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid} className="gap-1">
									<FieldLabel htmlFor="state">Estado</FieldLabel>
									<Input
										{...field}
										id="state"
										value={field.value ?? ""}
										placeholder="Ex: RS"
										onChange={(event) => {
											field.onChange(event.target.value.toUpperCase());
										}}
									/>
									{fieldState.invalid && (
										<FieldError id="state-error" errors={[fieldState.error]} />
									)}
								</Field>
							)}
						/>
					</FieldGroup>
				</div>

				<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
					<FieldGroup>
						<Controller
							name="city"
							control={control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid} className="gap-1">
									<FieldLabel htmlFor="city">Cidade</FieldLabel>
									<Input
										{...field}
										id="city"
										value={field.value ?? ""}
										placeholder="Ex: Porto Alegre"
										onChange={(event) => {
											field.onChange(formatTitleCase(event.target.value));
										}}
									/>
									{fieldState.invalid && (
										<FieldError id="city-error" errors={[fieldState.error]} />
									)}
								</Field>
							)}
						/>
					</FieldGroup>
					<FieldGroup>
						<Controller
							name="street"
							control={control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid} className="gap-1">
									<FieldLabel htmlFor="street">Rua</FieldLabel>
									<Input
										{...field}
										id="street"
										value={field.value ?? ""}
										placeholder="Ex: Av. Brasil"
										onChange={(event) => {
											field.onChange(formatTitleCase(event.target.value));
										}}
									/>
									{fieldState.invalid && (
										<FieldError id="street-error" errors={[fieldState.error]} />
									)}
								</Field>
							)}
						/>
					</FieldGroup>
				</div>

				<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
					<FieldGroup>
						<Controller
							name="neighborhood"
							control={control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid} className="gap-1">
									<FieldLabel htmlFor="neighborhood">Bairro</FieldLabel>
									<Input
										{...field}
										id="neighborhood"
										value={field.value ?? ""}
										placeholder="Ex: Centro"
										onChange={(event) => {
											field.onChange(formatTitleCase(event.target.value));
										}}
									/>
									{fieldState.invalid && (
										<FieldError
											id="neighborhood-error"
											errors={[fieldState.error]}
										/>
									)}
								</Field>
							)}
						/>
					</FieldGroup>
					<FieldGroup>
						<Controller
							name="number"
							control={control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid} className="gap-1">
									<FieldLabel htmlFor="number">Número</FieldLabel>
									<Input
										{...field}
										id="number"
										value={field.value ?? ""}
										placeholder="Ex: 120"
									/>
									{fieldState.invalid && (
										<FieldError id="number-error" errors={[fieldState.error]} />
									)}
								</Field>
							)}
						/>
					</FieldGroup>
					<FieldGroup>
						<Controller
							name="complement"
							control={control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid} className="gap-1">
									<FieldLabel htmlFor="complement">Complemento</FieldLabel>
									<Input
										{...field}
										id="complement"
										value={field.value ?? ""}
										placeholder="Ex: Sala 3"
									/>
									{fieldState.invalid && (
										<FieldError
											id="complement-error"
											errors={[fieldState.error]}
										/>
									)}
								</Field>
							)}
						/>
					</FieldGroup>
				</div>
			</section>

			<div className="flex justify-end gap-2">
				<Button type="submit">Salvar</Button>
			</div>
		</form>
	);
}
