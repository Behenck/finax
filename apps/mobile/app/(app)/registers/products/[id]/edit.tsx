import { useLocalSearchParams } from "expo-router";
import { ProductFormScreen } from "@/components/registers/product-form-screen";

export default function EditProductScreen() {
  const params = useLocalSearchParams<{ id: string }>();

  if (!params.id) {
    return null;
  }

  return <ProductFormScreen mode="edit" productId={params.id} />;
}
