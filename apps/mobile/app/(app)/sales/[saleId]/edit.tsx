import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import { AppScreen, Card } from "@/components/app/ui";
import { SaleFormScreen } from "@/components/sales/sale-form-screen";

export default function EditSaleScreen() {
  const params = useLocalSearchParams<{ saleId?: string | string[] }>();
  const saleId = Array.isArray(params.saleId) ? params.saleId[0] : params.saleId;

  if (!saleId) {
    return (
      <AppScreen>
        <Card>
          <Text className="text-[14px] text-red-700">ID da venda inválido.</Text>
        </Card>
      </AppScreen>
    );
  }

  return <SaleFormScreen mode="edit" saleId={saleId} />;
}
