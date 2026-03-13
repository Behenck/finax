import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, Text, View } from "react-native";
import {
  createProduct,
  getProduct,
  listProducts,
  registersQueryKeys,
  updateProduct,
} from "@/lib/registers";
import { productFormSchema, type ProductFormValues } from "@/lib/registers/form-schemas";
import { flattenProducts } from "@/lib/registers/helpers";
import { getApiErrorMessage } from "@/lib/errors";
import type { ProductInput } from "@/types/registers";
import { useOrganizationSlug } from "@/hooks/use-organization-slug";
import {
  AppButton,
  AppScreen,
  FormOptionGroup,
  FormTextField,
  PageHeader,
} from "@/components/app/ui";

type ProductFormScreenProps = {
  mode: "create" | "edit";
  productId?: string;
};

function getDefaultValues(): ProductFormValues {
  return {
    name: "",
    description: "",
    parentId: undefined,
    isActive: true,
    sortOrder: 0,
  };
}

export function ProductFormScreen({ mode, productId }: ProductFormScreenProps) {
  const slug = useOrganizationSlug();
  const queryClient = useQueryClient();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: getDefaultValues(),
  });

  const productQuery = useQuery({
    queryKey: productId ? registersQueryKeys.product(slug, productId) : ["noop"],
    queryFn: () => getProduct(slug, productId!),
    enabled: mode === "edit" && Boolean(productId),
  });

  const productsQuery = useQuery({
    queryKey: registersQueryKeys.products(slug),
    queryFn: () => listProducts(slug),
  });

  useEffect(() => {
    if (!productQuery.data) {
      return;
    }

    const product = productQuery.data;
    form.reset({
      name: product.name,
      description: product.description ?? "",
      parentId: product.parentId ?? undefined,
      isActive: product.isActive,
      sortOrder: product.sortOrder,
    });
  }, [form, productQuery.data]);

  const createMutation = useMutation({
    mutationFn: (payload: ProductInput) => createProduct(slug, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: registersQueryKeys.products(slug),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: ProductInput) => updateProduct(slug, productId!, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: registersQueryKeys.products(slug),
      });

      if (productId) {
        await queryClient.invalidateQueries({
          queryKey: registersQueryKeys.product(slug, productId),
        });
      }
    },
  });

  const parentOptions = useMemo(() => {
    const flattened = flattenProducts(productsQuery.data ?? []);
    return flattened
      .filter((product) => product.id !== productId)
      .map((product) => ({
        value: product.id,
        label: `${"• ".repeat(product.depth)}${product.name}`,
      }));
  }, [productId, productsQuery.data]);

  async function onSubmit(values: ProductFormValues) {
    const payload: ProductInput = {
      name: values.name,
      description: values.description || null,
      parentId: values.parentId ?? null,
      isActive: values.isActive,
      sortOrder: Number(values.sortOrder),
    };

    try {
      if (mode === "create") {
        const createdId = await createMutation.mutateAsync(payload);
        Alert.alert("Sucesso", "Produto cadastrado com sucesso.");
        router.replace(`/registers/products/${createdId}/edit`);
        return;
      }

      await updateMutation.mutateAsync(payload);
      Alert.alert("Sucesso", "Produto atualizado com sucesso.");
    } catch (error) {
      Alert.alert("Erro", getApiErrorMessage(error, "Não foi possível salvar o produto."));
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isLoading = productQuery.isLoading && mode === "edit";

  if (isLoading) {
    return (
      <AppScreen>
        <Text className="px-4 py-6 text-[14px] text-slate-500">Carregando produto...</Text>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <PageHeader
        title={mode === "create" ? "Novo Produto" : "Editar Produto"}
        description="Modo simplificado de cadastro de produtos."
      />

      <FormTextField control={form.control} name="name" label="Nome" />
      <FormTextField
        control={form.control}
        name="description"
        label="Descrição"
        multiline
      />
      <FormOptionGroup
        control={form.control}
        name="parentId"
        label="Produto Pai (opcional)"
        nullable
        noneLabel="Sem pai"
        options={parentOptions}
      />
      <Controller
        control={form.control}
        name="isActive"
        render={({ field }) => (
          <View className="mb-3 gap-1.5">
            <Text className="text-[13px] font-semibold text-slate-900">Status</Text>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <AppButton
                  label="Ativo"
                  variant={field.value ? "primary" : "outline"}
                  onPress={() => field.onChange(true)}
                />
              </View>
              <View className="flex-1">
                <AppButton
                  label="Inativo"
                  variant={field.value ? "outline" : "primary"}
                  onPress={() => field.onChange(false)}
                />
              </View>
            </View>
          </View>
        )}
      />
      <FormTextField
        control={form.control}
        name="sortOrder"
        label="Ordem"
        keyboardType="numeric"
      />

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
