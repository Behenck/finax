import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Alert, Text, View } from "react-native";
import { AppButton, AppScreen, Card, EmptyState, FormOptionGroup, FormTextField, PageHeader, SearchField } from "@/components/app/ui";
import { useOrganizationSlug } from "@/hooks/use-organization-slug";
import {
  createCategory,
  deleteCategory,
  listCategories,
  registersQueryKeys,
  updateCategory,
} from "@/lib/registers";
import { categoryFormSchema, type CategoryFormValues } from "@/lib/registers/form-schemas";
import { flattenCategories, normalizeSearchValue } from "@/lib/registers/helpers";
import { getApiErrorMessage } from "@/lib/errors";
import type { Category, CategoryChild } from "@/types/registers";

type CategoryLike = Category | CategoryChild;

function isParentCategory(category: CategoryLike): category is Category {
  return (category as Category).children !== undefined;
}

export default function CategoriesScreen() {
  const slug = useOrganizationSlug();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingCategory, setEditingCategory] = useState<CategoryLike | null>(null);

  const categoriesQuery = useQuery({
    queryKey: registersQueryKeys.categories(slug),
    queryFn: () => listCategories(slug),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CategoryFormValues) => createCategory(slug, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: registersQueryKeys.categories(slug),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CategoryFormValues }) =>
      updateCategory(slug, id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: registersQueryKeys.categories(slug),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (categoryId: string) => deleteCategory(slug, categoryId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: registersQueryKeys.categories(slug),
      });
    },
  });

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      code: "",
      type: "OUTCOME",
      color: "#22c55e",
      icon: "Tag",
      parentId: undefined,
    },
  });

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);
  const filteredCategories = useMemo(() => {
    const query = normalizeSearchValue(search);
    if (!query) {
      return categories;
    }

    return categories
      .map((category) => {
        const categoryMatch =
          category.name.toLowerCase().includes(query) ||
          (category.code ?? "").toLowerCase().includes(query);

        const children = category.children.filter((child) => {
          return (
            child.name.toLowerCase().includes(query) ||
            (child.code ?? "").toLowerCase().includes(query)
          );
        });

        if (categoryMatch) {
          return category;
        }

        if (children.length > 0) {
          return {
            ...category,
            children,
          };
        }

        return null;
      })
      .filter((item): item is Category => item !== null);
  }, [categories, search]);

  const incomeCategories = filteredCategories.filter((category) => category.type === "INCOME");
  const outcomeCategories = filteredCategories.filter((category) => category.type === "OUTCOME");

  const parentOptions = flatCategories
    .filter((category) => category.id !== editingCategory?.id)
    .map((category) => ({
      label: `${isParentCategory(category) ? "" : "• "}${category.name}`,
      value: category.id,
    }));

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  function resetForm() {
    setEditingCategory(null);
    form.reset({
      name: "",
      code: "",
      type: "OUTCOME",
      color: "#22c55e",
      icon: "Tag",
      parentId: undefined,
    });
  }

  async function handleSubmit(values: CategoryFormValues) {
    try {
      if (editingCategory) {
        await updateMutation.mutateAsync({
          id: editingCategory.id,
          payload: values,
        });
        Alert.alert("Sucesso", "Categoria atualizada com sucesso.");
      } else {
        await createMutation.mutateAsync(values);
        Alert.alert("Sucesso", "Categoria criada com sucesso.");
      }

      resetForm();
    } catch (error) {
      Alert.alert("Erro", getApiErrorMessage(error, "Não foi possível salvar a categoria."));
    }
  }

  function handleEditCategory(category: CategoryLike) {
    setEditingCategory(category);
    form.reset({
      name: category.name,
      code: category.code ?? "",
      type: category.type,
      color: category.color,
      icon: category.icon,
      parentId: isParentCategory(category) ? undefined : category.parentId,
    });
  }

  function handleDeleteCategory(category: CategoryLike) {
    Alert.alert("Excluir categoria", `Deseja excluir "${category.name}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await deleteMutation.mutateAsync(category.id);
              if (editingCategory?.id === category.id) {
                resetForm();
              }
            } catch (error) {
              Alert.alert(
                "Erro",
                getApiErrorMessage(error, "Não foi possível excluir a categoria."),
              );
            }
          })();
        },
      },
    ]);
  }

  function renderCategoryCard(category: Category) {
    return (
      <Card key={category.id}>
        <View className="mb-2 flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="text-[15px] font-semibold text-slate-900">
              {category.name}
              {category.code ? ` (${category.code})` : ""}
            </Text>
            <Text className="text-[12px] text-slate-500">
              {category.icon} • {category.color}
            </Text>
          </View>
          <View className="flex-row gap-2">
            <AppButton label="Editar" variant="outline" onPress={() => handleEditCategory(category)} />
            <AppButton
              label="Excluir"
              variant="danger"
              loading={deleteMutation.isPending}
              onPress={() => handleDeleteCategory(category)}
            />
          </View>
        </View>

        {category.children.length > 0 ? (
          <View className="border-t border-slate-200 pt-2">
            {category.children.map((child) => (
              <View key={child.id} className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <View className="mb-1 flex-row items-center justify-between gap-2">
                  <Text className="flex-1 text-[13px] font-semibold text-slate-800">
                    {child.name}
                    {child.code ? ` (${child.code})` : ""}
                  </Text>
                  <View className="flex-row gap-2">
                    <AppButton
                      label="Editar"
                      variant="outline"
                      onPress={() => handleEditCategory(child)}
                    />
                    <AppButton
                      label="Excluir"
                      variant="danger"
                      loading={deleteMutation.isPending}
                      onPress={() => handleDeleteCategory(child)}
                    />
                  </View>
                </View>
                <Text className="text-[12px] text-slate-500">
                  {child.icon} • {child.color}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </Card>
    );
  }

  return (
    <AppScreen>
      <PageHeader
        title="Categorias"
        description="Gerencie categorias agrupadas por receita e despesa."
      />

      <SearchField value={search} onChangeText={setSearch} placeholder="Buscar por nome ou código..." />

      <Card>
        <Text className="mb-2 text-[14px] font-semibold text-slate-900">
          {editingCategory ? "Editar Categoria" : "Nova Categoria"}
        </Text>
        <FormTextField control={form.control} name="name" label="Nome" />
        <FormTextField control={form.control} name="code" label="Código (opcional)" />
        <FormOptionGroup
          control={form.control}
          name="type"
          label="Tipo"
          options={[
            { label: "Receita", value: "INCOME" },
            { label: "Despesa", value: "OUTCOME" },
          ]}
        />
        <FormTextField control={form.control} name="color" label="Cor (HEX)" />
        <FormTextField control={form.control} name="icon" label="Ícone" />
        <FormOptionGroup
          control={form.control}
          name="parentId"
          label="Categoria Pai (opcional)"
          nullable
          noneLabel="Sem pai"
          options={parentOptions}
        />

        <View className="mt-1 flex-row gap-2">
          {editingCategory ? (
            <View className="flex-1">
              <AppButton label="Cancelar" variant="outline" onPress={resetForm} disabled={isPending} />
            </View>
          ) : null}
          <View className="flex-1">
            <AppButton
              label={editingCategory ? "Salvar" : "Adicionar"}
              loading={isPending}
              onPress={form.handleSubmit((values) => {
                void handleSubmit(values);
              })}
            />
          </View>
        </View>
      </Card>

      {categoriesQuery.isLoading ? (
        <Text className="py-8 text-center text-[14px] text-slate-500">Carregando categorias...</Text>
      ) : null}
      {categoriesQuery.isError ? <EmptyState message="Erro ao carregar categorias." /> : null}
      {!categoriesQuery.isLoading &&
      !categoriesQuery.isError &&
      incomeCategories.length === 0 &&
      outcomeCategories.length === 0 ? (
        <EmptyState message="Nenhuma categoria encontrada." />
      ) : null}

      {outcomeCategories.length > 0 ? (
        <View className="mb-2">
          <Text className="mb-2 text-[15px] font-bold text-slate-900">Despesas</Text>
          {outcomeCategories.map(renderCategoryCard)}
        </View>
      ) : null}

      {incomeCategories.length > 0 ? (
        <View>
          <Text className="mb-2 text-[15px] font-bold text-slate-900">Receitas</Text>
          {incomeCategories.map(renderCategoryCard)}
        </View>
      ) : null}
    </AppScreen>
  );
}
