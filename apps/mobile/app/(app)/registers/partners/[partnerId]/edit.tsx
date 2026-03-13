import { useLocalSearchParams } from "expo-router";
import { PartnerFormScreen } from "@/components/registers/partner-form-screen";

export default function EditPartnerScreen() {
  const params = useLocalSearchParams<{ partnerId: string }>();

  if (!params.partnerId) {
    return null;
  }

  return <PartnerFormScreen mode="edit" partnerId={params.partnerId} />;
}
