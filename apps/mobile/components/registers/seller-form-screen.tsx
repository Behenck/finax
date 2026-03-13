import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Alert, Text, View } from "react-native";
import {
  createSeller,
  getSeller,
  registersQueryKeys,
  updateSeller,
} from "@/lib/registers";
import { sellerFormSchema, type SellerFormValues } from "@/lib/registers/form-schemas";
import { getApiErrorMessage } from "@/lib/errors";
import { maskCpfOrCnpj, maskPhone, maskZipCode, unmask } from "@/lib/masks";
import type { SellerInput } from "@/types/registers";
import { useOrganizationSlug } from "@/hooks/use-organization-slug";
import {
  AppButton,
  AppScreen,
  FormOptionGroup,
  FormTextField,
  PageHeader,
} from "@/components/app/ui";

type SellerFormScreenProps = {
  mode: "create" | "edit";
  sellerId?: string;
};

function getDefaultValues(): SellerFormValues {
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
  };
}

export function SellerFormScreen({ mode, sellerId }: SellerFormScreenProps) {
  const slug = useOrganizationSlug();
  const queryClient = useQueryClient();

  const form = useForm<SellerFormValues>({
    resolver: zodResolver(sellerFormSchema),
    defaultValues: getDefaultValues(),
  });

  const sellerQuery = useQuery({
    queryKey: sellerId ? registersQueryKeys.seller(slug, sellerId) : ["noop"],
    queryFn: () => getSeller(slug, sellerId!),
    enabled: mode === "edit" && Boolean(sellerId),
  });

  useEffect(() => {
    if (!sellerQuery.data) {
      return;
    }

    const seller = sellerQuery.data;
    form.reset({
      name: seller.name,
      email: seller.email,
      phone: seller.phone,
      companyName: seller.companyName,
      documentType: seller.documentType,
      document: seller.document,
      country: seller.country,
      state: seller.state,
      city: seller.city ?? "",
      street: seller.street ?? "",
      zipCode: seller.zipCode ?? "",
      neighborhood: seller.neighborhood ?? "",
      number: seller.number ?? "",
      complement: seller.complement ?? "",
      status: seller.status,
    });
  }, [form, sellerQuery.data]);

  const createMutation = useMutation({
    mutationFn: (payload: SellerInput) => createSeller(slug, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: registersQueryKeys.sellers(slug),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: SellerInput) => updateSeller(slug, sellerId!, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: registersQueryKeys.sellers(slug),
      });

      if (sellerId) {
        await queryClient.invalidateQueries({
          queryKey: registersQueryKeys.seller(slug, sellerId),
        });
      }
    },
  });

  async function onSubmit(values: SellerFormValues) {
    const payload: SellerInput = {
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
    };

    try {
      if (mode === "create") {
        const createdId = await createMutation.mutateAsync(payload);
        Alert.alert("Sucesso", "Vendedor cadastrado com sucesso.");
        router.replace(`/registers/sellers/${createdId}/edit`);
        return;
      }

      await updateMutation.mutateAsync(payload);
      Alert.alert("Sucesso", "Vendedor atualizado com sucesso.");
    } catch (error) {
      Alert.alert("Erro", getApiErrorMessage(error, "Não foi possível salvar o vendedor."));
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isLoading = sellerQuery.isLoading && mode === "edit";

  if (isLoading) {
    return (
      <AppScreen>
        <Text className="px-4 py-6 text-[14px] text-slate-500">Carregando vendedor...</Text>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <PageHeader
        title={mode === "create" ? "Novo Vendedor" : "Editar Vendedor"}
        description="Cadastre e mantenha os dados comerciais dos vendedores."
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
