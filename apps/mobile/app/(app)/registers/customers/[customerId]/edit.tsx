import { useLocalSearchParams } from "expo-router";
import { CustomerFormScreen } from "@/components/registers/customer-form-screen";

export default function EditCustomerScreen() {
  const params = useLocalSearchParams<{ customerId: string }>();

  if (!params.customerId) {
    return null;
  }

  return <CustomerFormScreen mode="edit" customerId={params.customerId} />;
}
