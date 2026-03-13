import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import { AppButton, AppScreen, Card, EmptyState, PageHeader, SearchField } from "@/components/app/ui";
import { useOrganizationSlug } from "@/hooks/use-organization-slug";
import { deleteProduct, listProducts, registersQueryKeys, updateProduct } from "@/lib/registers";
import { flattenProducts, normalizeSearchValue } from "@/lib/registers/helpers";
import { getApiErrorMessage } from "@/lib/errors";

export default function ProductsScreen() {
  const slug = useOrganizationSlug();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const productsQuery = useQuery({
    queryKey: registersQueryKeys.products(slug),
    queryFn: () => listProducts(slug),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        name: string;
        description: string | null;
        parentId: string | null;
        isActive: boolean;
        sortOrder: number;
      };
    }) => updateProduct(slug, id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: registersQueryKeys.products(slug) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProduct(slug, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: registersQueryKeys.products(slug) });
    },
  });

  const flattenedProducts = useMemo(() => {
    const flattened = flattenProducts(productsQuery.data ?? []);
    const query = normalizeSearchValue(search);
    if (!query) {
      return flattened;
    }

    return flattened.filter((product) => {
      return (
        product.name.toLowerCase().includes(query) ||
        (product.description ?? "").toLowerCase().includes(query)
      );
    });
  }, [productsQuery.data, search]);

  function handleToggleProduct(product: (typeof flattenedProducts)[number]) {
    void (async () => {
      try {
        await updateMutation.mutateAsync({
          id: product.id,
          payload: {
            name: product.name,
            description: product.description,
            parentId: product.parentId,
            sortOrder: product.sortOrder,
            isActive: !product.isActive,
          },
        });
      } catch (error) {
        Alert.alert(
          "Erro",
          getApiErrorMessage(error, "Não foi possível alterar o status do produto."),
        );
      }
    })();
  }

  function handleDeleteProduct(productId: string, productName: string) {
    Alert.alert("Excluir produto", `Deseja excluir "${productName}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await deleteMutation.mutateAsync(productId);
            } catch (error) {
              Alert.alert(
                "Não foi possível excluir",
                getApiErrorMessage(
                  error,
                  "Este produto possui vínculos e não pode ser removido.",
                ),
              );
            }
          })();
        },
      },
    ]);
  }

  return (
    <AppScreen>
      <PageHeader
        title="Produtos"
        description="Cadastro simplificado de produtos em estrutura de árvore."
        action={<AppButton label="Novo" onPress={() => router.push("/registers/products/create")} />}
      />

      <SearchField
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar por nome ou descrição..."
      />

      {productsQuery.isLoading ? (
        <Text className="py-8 text-center text-[14px] text-slate-500">Carregando produtos...</Text>
      ) : null}
      {productsQuery.isError ? <EmptyState message="Erro ao carregar produtos." /> : null}
      {!productsQuery.isLoading && !productsQuery.isError && flattenedProducts.length === 0 ? (
        <EmptyState message="Nenhum produto encontrado." />
      ) : null}

      {flattenedProducts.map((product) => (
        <Card key={product.id}>
          <View
            className="mb-2"
            style={{
              paddingLeft: product.depth * 12,
            }}
          >
            <View className="mb-1 flex-row items-center justify-between gap-3">
              <Text className="flex-1 text-[16px] font-semibold text-slate-900">{product.name}</Text>
              <View
                className={`rounded-full px-2.5 py-1 ${
                  product.isActive ? "bg-emerald-100" : "bg-amber-100"
                }`}
              >
                <Text
                  className={`text-[11px] font-semibold ${
                    product.isActive ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {product.isActive ? "Ativo" : "Inativo"}
                </Text>
              </View>
            </View>
            <Text className="text-[12px] text-slate-500">Ordem: {product.sortOrder}</Text>
            <Text className="mb-3 text-[12px] text-slate-500">
              {product.description || "Sem descrição"}
            </Text>
          </View>

          <View className="flex-row flex-wrap gap-2">
            <View className="min-w-[110px] flex-1">
              <AppButton
                label="Editar"
                variant="outline"
                onPress={() => router.push(`/registers/products/${product.id}/edit`)}
              />
            </View>
            <View className="min-w-[110px] flex-1">
              <AppButton
                label={product.isActive ? "Inativar" : "Ativar"}
                variant="outline"
                loading={updateMutation.isPending}
                onPress={() => handleToggleProduct(product)}
              />
            </View>
            <View className="min-w-[110px] flex-1">
              <AppButton
                label="Excluir"
                variant="danger"
                loading={deleteMutation.isPending}
                onPress={() => handleDeleteProduct(product.id, product.name)}
              />
            </View>
          </View>
        </Card>
      ))}
    </AppScreen>
  );
}
