import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Alert, Text, View } from "react-native";
import {
  createPartner,
  getPartner,
  listPartners,
  registersQueryKeys,
  updatePartner,
} from "@/lib/registers";
import { partnerFormSchema, type PartnerFormValues } from "@/lib/registers/form-schemas";
import { getApiErrorMessage } from "@/lib/errors";
import { maskCpfOrCnpj, maskPhone, maskZipCode, unmask } from "@/lib/masks";
import type { PartnerInput } from "@/types/registers";
import { useOrganizationSlug } from "@/hooks/use-organization-slug";
import {
  AppButton,
  AppScreen,
  FormOptionGroup,
  FormTextField,
  PageHeader,
} from "@/components/app/ui";

type PartnerFormScreenProps = {
  mode: "create" | "edit";
  partnerId?: string;
};

function getDefaultValues(): PartnerFormValues {
  return {
    name: "",
    email: "",
    phone: "",
    companyName: "",
    documentType: "CPF",
    document: "",
    country: "BR",
    state: "",
    city: "",
    street: "",
    zipCode: "",
    neighborhood: "",
    number: "",
    complement: "",
    status: "ACTIVE",
    supervisorId: undefined,
  };
}

export function PartnerFormScreen({ mode, partnerId }: PartnerFormScreenProps) {
  const slug = useOrganizationSlug();
  const queryClient = useQueryClient();

  const form = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerFormSchema),
    defaultValues: getDefaultValues(),
  });

  const partnerQuery = useQuery({
    queryKey: partnerId ? registersQueryKeys.partner(slug, partnerId) : ["noop"],
    queryFn: () => getPartner(slug, partnerId!),
    enabled: mode === "edit" && Boolean(partnerId),
  });

  const partnersQuery = useQuery({
    queryKey: registersQueryKeys.partners(slug),
    queryFn: () => listPartners(slug),
  });

  useEffect(() => {
    if (!partnerQuery.data) {
      return;
    }

    const partner = partnerQuery.data;
    form.reset({
      name: partner.name,
      email: partner.email,
      phone: partner.phone,
      companyName: partner.companyName,
      documentType: partner.documentType,
      document: partner.document,
      country: partner.country,
      state: partner.state,
      city: partner.city ?? "",
      street: partner.street ?? "",
      zipCode: partner.zipCode ?? "",
      neighborhood: partner.neighborhood ?? "",
      number: partner.number ?? "",
      complement: partner.complement ?? "",
      status: partner.status,
      supervisorId: partner.supervisor?.id,
    });
  }, [form, partnerQuery.data]);

  const createMutation = useMutation({
    mutationFn: (payload: PartnerInput) => createPartner(slug, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: registersQueryKeys.partners(slug),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: PartnerInput) => updatePartner(slug, partnerId!, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: registersQueryKeys.partners(slug),
      });

      if (partnerId) {
        await queryClient.invalidateQueries({
          queryKey: registersQueryKeys.partner(slug, partnerId),
        });
      }
    },
  });

  async function onSubmit(values: PartnerFormValues) {
    const payload: PartnerInput = {
      name: values.name,
      email: values.email,
      phone: unmask(values.phone),
      companyName: values.companyName,
      documentType: values.documentType,
      document: unmask(values.document),
      country: values.country,
      state: values.state,
      city: values.city,
      street: values.street,
      zipCode: values.zipCode ? unmask(values.zipCode) : undefined,
      neighborhood: values.neighborhood,
      number: values.number,
      complement: values.complement,
      status: values.status,
      supervisorId: values.supervisorId,
    };

    try {
      if (mode === "create") {
        const createdId = await createMutation.mutateAsync(payload);
        Alert.alert("Sucesso", "Parceiro cadastrado com sucesso.");
        router.replace(`/registers/partners/${createdId}/edit`);
        return;
      }

      await updateMutation.mutateAsync(payload);
      Alert.alert("Sucesso", "Parceiro atualizado com sucesso.");
    } catch (error) {
      Alert.alert("Erro", getApiErrorMessage(error, "Não foi possível salvar o parceiro."));
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isLoading = partnerQuery.isLoading && mode === "edit";
  const partnerOptions =
    partnersQuery.data
      ?.filter((partner) => partner.id !== partnerId)
      .map((partner) => ({ label: partner.name, value: partner.id })) ?? [];

  if (isLoading) {
    return (
      <AppScreen>
        <Text className="px-4 py-6 text-[14px] text-slate-500">Carregando parceiro...</Text>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <PageHeader
        title={mode === "create" ? "Novo Parceiro" : "Editar Parceiro"}
        description="Cadastre parceiros e configure supervisor quando necessário."
      />

      <FormTextField control={form.control} name="name" label="Nome" />
      <FormTextField
        control={form.control}
        name="email"
        label="E-mail"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <FormTextField
        control={form.control}
        name="phone"
        label="Telefone"
        keyboardType="phone-pad"
        transform={maskPhone}
      />
      <FormTextField control={form.control} name="companyName" label="Empresa" />
      <FormOptionGroup
        control={form.control}
        name="documentType"
        label="Tipo de Documento"
        options={[
          { label: "CPF", value: "CPF" },
          { label: "CNPJ", value: "CNPJ" },
        ]}
      />
      <FormTextField
        control={form.control}
        name="document"
        label="Documento"
        keyboardType="numeric"
        transform={maskCpfOrCnpj}
      />
      <FormOptionGroup
        control={form.control}
        name="status"
        label="Status"
        options={[
          { label: "Ativo", value: "ACTIVE" },
          { label: "Inativo", value: "INACTIVE" },
        ]}
      />
      <FormOptionGroup
        control={form.control}
        name="supervisorId"
        label="Supervisor (opcional)"
        nullable
        noneLabel="Sem supervisor"
        options={partnerOptions}
      />

      <View className="border-t border-slate-200 pt-3">
        <Text className="mb-2 text-[14px] font-semibold text-slate-900">Endereço</Text>
        <FormTextField control={form.control} name="country" label="País" />
        <FormTextField control={form.control} name="state" label="Estado" />
        <FormTextField control={form.control} name="city" label="Cidade" />
        <FormTextField control={form.control} name="street" label="Rua" />
        <FormTextField
          control={form.control}
          name="zipCode"
          label="CEP"
          keyboardType="numeric"
          transform={maskZipCode}
        />
        <FormTextField control={form.control} name="neighborhood" label="Bairro" />
        <FormTextField control={form.control} name="number" label="Número" />
        <FormTextField control={form.control} name="complement" label="Complemento" />
      </View>

      <View className="mt-3 flex-row gap-2">
        <View className="flex-1">
          <AppButton
            label="Cancelar"
            variant="outline"
            onPress={() => router.back()}
            disabled={isPending}
          />
        </View>
        <View className="flex-1">
          <AppButton
            label={mode === "create" ? "Cadastrar" : "Salvar"}
            loading={isPending}
            onPress={form.handleSubmit((values) => {
              void onSubmit(values);
            })}
          />
        </View>
      </View>
    </AppScreen>
  );
}
