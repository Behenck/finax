import { Button } from "@/components/ui/button";
import {
  transactionSchema,
  type TransactionFormData,
} from "@/schemas/transaction-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import { FormProvider, useForm } from "react-hook-form";
import { TypesField } from "../create/-fields/types-field";
import { BasicInformationField } from "../create/-fields/basic-information-field";
import { ClassificationField } from "../create/-fields/classification-field";
import { AmountItemsField } from "../create/-fields/amount-items-field";
import { InstallmentsRecurrenceField } from "../create/-fields/installments-recurrence-field";
import { RefundField } from "../create/-fields/refund-field";
import { NotesField } from "../create/-fields/notes-field";
import { useCreateTransaction } from "@/hooks/transactions/use-create-transaction";
import { formatCurrencyBRL, parseBRLCurrencyToNumber } from "@/utils/format-amount";
import type { GetOrganizationsSlugTransactionsTransactionid200 } from "@/http/generated";
import { startOfDay } from "date-fns";

interface TransactionFormProps {
  initialData?: GetOrganizationsSlugTransactionsTransactionid200["transaction"]
}

export function TransactionForm({ initialData }: TransactionFormProps) {
  const { mutateAsync: createTransaction } = useCreateTransaction()

  const mappedItems = initialData?.transactionItens?.map((item) => ({
    ...item,
    amount: formatCurrencyBRL(item.amount),
  })) ?? []

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema as any),
    defaultValues: {
      type: initialData?.type ?? "OUTCOME",
      nature: initialData?.nature ?? "VARIABLE",
      description: initialData?.description ?? "",
      dueDate: startOfDay(initialData?.dueDate ?? new Date()),
      expectedPaymentDate: startOfDay(initialData?.expectedPaymentDate ?? new Date()),
      companyId: initialData?.companyId ?? "",
      unitId: initialData?.unitId ?? "",
      costCenterId: initialData?.costCenterId ?? "",
      categoryId: initialData?.categoryId ?? "",
      totalAmount: formatCurrencyBRL(initialData?.totalAmount ?? 0),
      employeeIdRefunded: initialData?.refundedByEmployeeId ?? "",
      notes: initialData?.notes ?? "",
      items: mappedItems ?? [],
      installmentRecurrenceType: "SINGLE",
      installmentRecurrenceQuantity: 2,
    },
  });
  const { handleSubmit, control } = form

  async function onSubmit(data: TransactionFormData) {
    try {
      const { totalAmount, ...rest } = data

      const payload = {
        ...rest,
        totalAmount: parseBRLCurrencyToNumber(data.totalAmount),
        items: data.items?.map(item => ({
          ...item,
          amount: parseBRLCurrencyToNumber(item.amount),
        }))
      }

      console.log(payload)

      await createTransaction(payload)
    } catch (err) {
      console.log(err)
    }
  }

  const onError = (errors: any) => {
    console.log("❌ FORM ERRORS", errors)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-6">
      <FormProvider {...form}>
        <TypesField control={control} />
        <BasicInformationField control={control} />
        <ClassificationField control={control} />
        <AmountItemsField isItems={!!initialData?.transactionItens} />
        <InstallmentsRecurrenceField control={control} />
        <RefundField control={control} />
        <NotesField control={control} />
      </FormProvider>

      <div className="flex gap-3 items-center justify-end">
        <Button variant="outline" asChild>
          <Link to="/transactions">Cancelar</Link>
        </Button>
        <Button type="submit">Salvar Transação</Button>
      </div>
    </form>
  );
}
