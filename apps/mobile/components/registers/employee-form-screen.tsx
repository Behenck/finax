import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Alert, Text, View } from "react-native";
import {
  createEmployee,
  listCompanies,
  listEmployees,
  registersQueryKeys,
  updateEmployee,
} from "@/lib/registers";
import { employeeFormSchema, type EmployeeFormValues } from "@/lib/registers/form-schemas";
import { getApiErrorMessage } from "@/lib/errors";
import { maskCpf, maskPhone, maskZipCode, unmask } from "@/lib/masks";
import type { EmployeeInput } from "@/types/registers";
import { useOrganizationSlug } from "@/hooks/use-organization-slug";
import {
  AppButton,
  AppScreen,
  FormOptionGroup,
  FormTextField,
  PageHeader,
} from "@/components/app/ui";

type EmployeeFormScreenProps = {
  mode: "create" | "edit";
  employeeId?: string;
};

function getDefaultValues(): EmployeeFormValues {
  return {
    name: "",
    role: "",
    email: "",
    phone: "",
    department: "",
    cpf: "",
    pixKeyType: undefined,
    pixKey: "",
    paymentNotes: "",
    country: "BR",
    state: "",
    city: "",
    street: "",
    zipCode: "",
    neighborhood: "",
    number: "",
    complement: "",
    companyId: "",
    unitId: undefined,
  };
}

export function EmployeeFormScreen({ mode, employeeId }: EmployeeFormScreenProps) {
  const slug = useOrganizationSlug();
  const queryClient = useQueryClient();

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: getDefaultValues(),
  });

  const companiesQuery = useQuery({
    queryKey: registersQueryKeys.companies(slug),
    queryFn: () => listCompanies(slug),
  });

  const employeesQuery = useQuery({
    queryKey: registersQueryKeys.employees(slug),
    queryFn: () => listEmployees(slug),
    enabled: mode === "edit" && Boolean(employeeId),
  });

  const employee = useMemo(
    () => employeesQuery.data?.find((item) => item.id === employeeId),
    [employeeId, employeesQuery.data],
  );

  useEffect(() => {
    if (!employee) {
      return;
    }

    form.reset({
      name: employee.name,
      role: employee.role ?? "",
      email: employee.email,
      phone: employee.phone ?? "",
      department: employee.department ?? "",
      cpf: employee.cpf ?? "",
      pixKeyType: employee.pixKeyType ?? undefined,
      pixKey: employee.pixKey ?? "",
      paymentNotes: employee.paymentNotes ?? "",
      country: employee.country ?? "BR",
      state: employee.state ?? "",
      city: employee.city ?? "",
      street: employee.street ?? "",
      zipCode: employee.zipCode ?? "",
      neighborhood: employee.neighborhood ?? "",
      number: employee.number ?? "",
      complement: employee.complement ?? "",
      companyId: employee.company.id,
      unitId: employee.unit?.id ?? undefined,
    });
  }, [employee, form]);

  const selectedCompanyId = form.watch("companyId");
  const companyUnits = useMemo(
    () =>
      companiesQuery.data?.find((company) => company.id === selectedCompanyId)?.units ?? [],
    [companiesQuery.data, selectedCompanyId],
  );

  useEffect(() => {
    const selectedUnit = form.getValues("unitId");
    if (!selectedUnit) {
      return;
    }

    const unitExistsInCompany = companyUnits.some((unit) => unit.id === selectedUnit);
    if (!unitExistsInCompany) {
      form.setValue("unitId", undefined);
    }
  }, [companyUnits, form, selectedCompanyId]);

  const createMutation = useMutation({
    mutationFn: (payload: EmployeeInput) => createEmployee(slug, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: registersQueryKeys.employees(slug),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: EmployeeInput) => updateEmployee(slug, employeeId!, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: registersQueryKeys.employees(slug),
      });
    },
  });

  async function onSubmit(values: EmployeeFormValues) {
    const payload: EmployeeInput = {
      name: values.name,
      role: values.role,
      email: values.email,
      phone: values.phone ? unmask(values.phone) : undefined,
      department: values.department,
      cpf: values.cpf ? unmask(values.cpf) : undefined,
      pixKeyType: values.pixKeyType,
      pixKey: values.pixKey,
      paymentNotes: values.paymentNotes,
      country: values.country,
      state: values.state,
      city: values.city,
      street: values.street,
      zipCode: values.zipCode ? unmask(values.zipCode) : undefined,
      neighborhood: values.neighborhood,
      number: values.number,
      complement: values.complement,
      companyId: values.companyId,
      unitId: values.unitId,
    };

    try {
      if (mode === "create") {
        const createdId = await createMutation.mutateAsync(payload);
        Alert.alert("Sucesso", "Funcionário cadastrado com sucesso.");
        router.replace(`/registers/employees/${createdId}/edit`);
        return;
      }

      await updateMutation.mutateAsync(payload);
      Alert.alert("Sucesso", "Funcionário atualizado com sucesso.");
    } catch (error) {
      Alert.alert("Erro", getApiErrorMessage(error, "Não foi possível salvar o funcionário."));
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isLoading = mode === "edit" && employeesQuery.isLoading;

  if (isLoading) {
    return (
      <AppScreen>
        <Text className="px-4 py-6 text-[14px] text-slate-500">Carregando funcionário...</Text>
      </AppScreen>
    );
  }

  if (mode === "edit" && !employee && !employeesQuery.isLoading) {
    return (
      <AppScreen>
        <Text className="px-4 py-6 text-[14px] text-slate-500">Funcionário não encontrado.</Text>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <PageHeader
        title={mode === "create" ? "Novo Funcionário" : "Editar Funcionário"}
        description="Defina empresa, unidade e dados de pagamento."
      />

      <FormTextField control={form.control} name="name" label="Nome" />
      <FormTextField control={form.control} name="role" label="Cargo" />
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
      <FormTextField control={form.control} name="department" label="Departamento" />
      <FormTextField
        control={form.control}
        name="cpf"
        label="CPF"
        keyboardType="numeric"
        transform={maskCpf}
      />
      <FormOptionGroup
        control={form.control}
        name="pixKeyType"
        label="Tipo de Chave PIX (opcional)"
        nullable
        noneLabel="Sem chave"
        options={[
          { label: "CPF", value: "CPF" },
          { label: "CNPJ", value: "CNPJ" },
          { label: "E-mail", value: "EMAIL" },
          { label: "Telefone", value: "PHONE" },
          { label: "Aleatória", value: "RANDOM" },
        ]}
      />
      <FormTextField control={form.control} name="pixKey" label="Chave PIX" />
      <FormTextField
        control={form.control}
        name="paymentNotes"
        label="Observações de Pagamento"
        multiline
      />

      <View className="border-t border-slate-200 pt-3">
        <Text className="mb-2 text-[14px] font-semibold text-slate-900">Vínculo Organizacional</Text>
        <FormOptionGroup
          control={form.control}
          name="companyId"
          label="Empresa"
          options={
            companiesQuery.data?.map((company) => ({ label: company.name, value: company.id })) ??
            []
          }
        />
        <FormOptionGroup
          control={form.control}
          name="unitId"
          label="Unidade (opcional)"
          nullable
          noneLabel="Sem unidade"
          options={companyUnits.map((unit) => ({ label: unit.name, value: unit.id }))}
        />
      </View>

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
