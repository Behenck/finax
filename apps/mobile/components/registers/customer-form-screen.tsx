import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Alert, Text, View } from "react-native";
import {
  createCustomer,
  getCustomer,
  listPartners,
  listSellers,
  registersQueryKeys,
  updateCustomer,
} from "@/lib/registers";
import {
  customerFormSchema,
  type CustomerFormValues,
} from "@/lib/registers/form-schemas";
import { parseDateInput } from "@/lib/registers/helpers";
import { getApiErrorMessage } from "@/lib/errors";
import { maskCpfOrCnpj, maskPhone, unmask } from "@/lib/masks";
import type { CustomerInput } from "@/types/registers";
import { useOrganizationSlug } from "@/hooks/use-organization-slug";
import {
  AppButton,
  AppScreen,
  FormOptionGroup,
  FormTextField,
  PageHeader,
} from "@/components/app/ui";

type CustomerFormScreenProps = {
  mode: "create" | "edit";
  customerId?: string;
};

function getDefaultValues(): CustomerFormValues {
  return {
    personType: "PF",
    name: "",
    email: "",
    phone: "",
    documentType: "CPF",
    documentNumber: "",
    birthDate: "",
    monthlyIncome: "",
    profession: "",
    naturality: "",
    fatherName: "",
    motherName: "",
    responsibleType: undefined,
    responsibleId: undefined,
  };
}

export function CustomerFormScreen({ mode, customerId }: CustomerFormScreenProps) {
  const slug = useOrganizationSlug();
  const queryClient = useQueryClient();

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: getDefaultValues(),
  });

  const personType = form.watch("personType");
  const responsibleType = form.watch("responsibleType");

  const customerQuery = useQuery({
    queryKey: customerId ? registersQueryKeys.customer(slug, customerId) : ["noop"],
    queryFn: () => getCustomer(slug, customerId!),
    enabled: mode === "edit" && Boolean(customerId),
  });

  const sellersQuery = useQuery({
    queryKey: registersQueryKeys.sellers(slug),
    queryFn: () => listSellers(slug),
  });

  const partnersQuery = useQuery({
    queryKey: registersQueryKeys.partners(slug),
    queryFn: () => listPartners(slug),
  });

  useEffect(() => {
    if (!customerQuery.data) {
      return;
    }

    const customer = customerQuery.data;

    if (customer.personType === "PF") {
      const documentType =
        customer.documentType === "CPF" ||
        customer.documentType === "RG" ||
        customer.documentType === "PASSPORT" ||
        customer.documentType === "OTHER"
          ? customer.documentType
          : "CPF";

      form.reset({
        personType: "PF",
        name: customer.name,
        email: customer.email ?? "",
        phone: customer.phone ?? "",
        documentType,
        documentNumber: customer.documentNumber,
        birthDate: customer.pf?.birthDate ? customer.pf.birthDate.slice(0, 10) : "",
        monthlyIncome:
          customer.pf?.monthlyIncome != null ? String(customer.pf.monthlyIncome) : "",
        profession: customer.pf?.profession ?? "",
        naturality: customer.pf?.naturality ?? "",
        fatherName: customer.pf?.fatherName ?? "",
        motherName: customer.pf?.motherName ?? "",
        responsibleType: customer.responsible?.type,
        responsibleId: customer.responsible?.id,
      });
      return;
    }

    const documentType =
      customer.documentType === "CNPJ" ||
      customer.documentType === "IE" ||
      customer.documentType === "OTHER"
        ? customer.documentType
        : "CNPJ";

    form.reset({
      personType: "PJ",
      name: customer.name,
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      documentType,
      documentNumber: customer.documentNumber,
      tradeName: customer.pj?.tradeName ?? "",
      legalName: customer.pj?.legalName ?? "",
      stateRegistration: customer.pj?.stateRegistration ?? "",
      municipalRegistration: customer.pj?.municipalRegistration ?? "",
      foundationDate: customer.pj?.foundationDate
        ? customer.pj.foundationDate.slice(0, 10)
        : "",
      businessActivity: customer.pj?.businessActivity ?? "",
      responsibleType: customer.responsible?.type,
      responsibleId: customer.responsible?.id,
    });
  }, [customerQuery.data, form]);

  const createMutation = useMutation({
    mutationFn: (payload: CustomerInput) => createCustomer(slug, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: registersQueryKeys.customers(slug),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: CustomerInput) => updateCustomer(slug, customerId!, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: registersQueryKeys.customers(slug),
      });

      if (customerId) {
        await queryClient.invalidateQueries({
          queryKey: registersQueryKeys.customer(slug, customerId),
        });
      }
    },
  });

  const responsibleOptions = useMemo(() => {
    if (responsibleType === "SELLER") {
      return (sellersQuery.data ?? []).map((seller) => ({
        label: seller.name,
        value: seller.id,
      }));
    }

    if (responsibleType === "PARTNER") {
      return (partnersQuery.data ?? []).map((partner) => ({
        label: partner.name,
        value: partner.id,
      }));
    }

    return [];
  }, [partnersQuery.data, responsibleType, sellersQuery.data]);

  async function onSubmit(values: CustomerFormValues) {
    const payload: CustomerInput = {
      name: values.name,
      personType: values.personType,
      email: values.email,
      phone: values.phone ? unmask(values.phone) : undefined,
      documentType: values.documentType,
      documentNumber: unmask(values.documentNumber),
      responsible:
        values.responsibleType && values.responsibleId
          ? {
              type: values.responsibleType,
              id: values.responsibleId,
            }
          : null,
    };

    if (values.personType === "PF") {
      payload.pf = {
        birthDate: parseDateInput(values.birthDate),
        monthlyIncome: values.monthlyIncome ? Number(values.monthlyIncome) : undefined,
        profession: values.profession,
        naturality: values.naturality,
        fatherName: values.fatherName,
        motherName: values.motherName,
        placeOfBirth: values.naturality,
      };
    } else {
      payload.pj = {
        tradeName: values.tradeName,
        legalName: values.legalName,
        stateRegistration: values.stateRegistration,
        municipalRegistration: values.municipalRegistration,
        foundationDate: parseDateInput(values.foundationDate),
        businessActivity: values.businessActivity,
      };
    }

    try {
      if (mode === "create") {
        const createdId = await createMutation.mutateAsync(payload);
        Alert.alert("Sucesso", "Cliente cadastrado com sucesso.");
        router.replace(`/registers/customers/${createdId}/edit`);
        return;
      }

      await updateMutation.mutateAsync(payload);
      Alert.alert("Sucesso", "Cliente atualizado com sucesso.");
    } catch (error) {
      Alert.alert("Erro", getApiErrorMessage(error, "Não foi possível salvar o cliente."));
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isLoading = customerQuery.isLoading && mode === "edit";

  if (isLoading) {
    return (
      <AppScreen>
        <Text className="px-4 py-6 text-[14px] text-slate-500">Carregando cliente...</Text>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <PageHeader
        title={mode === "create" ? "Novo Cliente" : "Editar Cliente"}
        description="Cadastre clientes PF/PJ e associe responsável quando necessário."
      />

      <FormOptionGroup
        control={form.control}
        name="personType"
        label="Tipo de Pessoa"
        options={[
          { label: "Pessoa Física", value: "PF" },
          { label: "Pessoa Jurídica", value: "PJ" },
        ]}
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

      <FormOptionGroup
        control={form.control}
        name="documentType"
        label="Tipo de Documento"
        options={
          personType === "PF"
            ? [
                { label: "CPF", value: "CPF" },
                { label: "RG", value: "RG" },
                { label: "Passaporte", value: "PASSPORT" },
                { label: "Outro", value: "OTHER" },
              ]
            : [
                { label: "CNPJ", value: "CNPJ" },
                { label: "IE", value: "IE" },
                { label: "Outro", value: "OTHER" },
              ]
        }
      />

      <FormTextField
        control={form.control}
        name="documentNumber"
        label="Número do Documento"
        keyboardType="numeric"
        transform={maskCpfOrCnpj}
      />

      <View className="mb-3 border-t border-slate-200 pt-3">
        <Text className="mb-2 text-[14px] font-semibold text-slate-900">
          Responsável (opcional)
        </Text>
        <FormOptionGroup
          control={form.control}
          name="responsibleType"
          label="Tipo"
          nullable
          noneLabel="Sem responsável"
          options={[
            { label: "Vendedor", value: "SELLER" },
            { label: "Parceiro", value: "PARTNER" },
          ]}
        />

        {responsibleType ? (
          <FormOptionGroup
            control={form.control}
            name="responsibleId"
            label="Responsável"
            options={responsibleOptions}
          />
        ) : null}
      </View>

      {personType === "PF" ? (
        <View className="border-t border-slate-200 pt-3">
          <Text className="mb-2 text-[14px] font-semibold text-slate-900">Dados PF</Text>
          <FormTextField
            control={form.control}
            name="birthDate"
            label="Data de Nascimento"
            placeholder="AAAA-MM-DD"
          />
          <FormTextField
            control={form.control}
            name="monthlyIncome"
            label="Renda Mensal"
            keyboardType="numeric"
          />
          <FormTextField control={form.control} name="profession" label="Profissão" />
          <FormTextField control={form.control} name="naturality" label="Naturalidade" />
          <FormTextField control={form.control} name="fatherName" label="Nome do Pai" />
          <FormTextField control={form.control} name="motherName" label="Nome da Mãe" />
        </View>
      ) : (
        <View className="border-t border-slate-200 pt-3">
          <Text className="mb-2 text-[14px] font-semibold text-slate-900">Dados PJ</Text>
          <FormTextField control={form.control} name="tradeName" label="Nome Fantasia" />
          <FormTextField control={form.control} name="legalName" label="Razão Social" />
          <FormTextField
            control={form.control}
            name="stateRegistration"
            label="Inscrição Estadual"
          />
          <FormTextField
            control={form.control}
            name="municipalRegistration"
            label="Inscrição Municipal"
          />
          <FormTextField
            control={form.control}
            name="foundationDate"
            label="Data de Fundação"
            placeholder="AAAA-MM-DD"
          />
          <FormTextField
            control={form.control}
            name="businessActivity"
            label="Atividade Empresarial"
          />
        </View>
      )}

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
