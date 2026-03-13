import { useLocalSearchParams } from "expo-router";
import { SaleFormScreen } from "@/components/sales/sale-form-screen";

export default function CreateSaleScreen() {
  const params = useLocalSearchParams<{
    customerId?: string | string[];
    duplicateSaleId?: string | string[];
  }>();

  const prefilledCustomerId = Array.isArray(params.customerId)
    ? params.customerId[0]
    : params.customerId;
  const duplicateSaleId = Array.isArray(params.duplicateSaleId)
    ? params.duplicateSaleId[0]
    : params.duplicateSaleId;

  return (
    <SaleFormScreen
      mode="create"
      prefilledCustomerId={prefilledCustomerId}
      duplicateSaleId={duplicateSaleId}
    />
  );
}
