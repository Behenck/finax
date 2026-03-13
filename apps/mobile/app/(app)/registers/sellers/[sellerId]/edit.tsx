import { useLocalSearchParams } from "expo-router";
import { SellerFormScreen } from "@/components/registers/seller-form-screen";

export default function EditSellerScreen() {
  const params = useLocalSearchParams<{ sellerId: string }>();

  if (!params.sellerId) {
    return null;
  }

  return <SellerFormScreen mode="edit" sellerId={params.sellerId} />;
}
