import { useLocalSearchParams } from "expo-router";
import { EmployeeFormScreen } from "@/components/registers/employee-form-screen";

export default function EditEmployeeScreen() {
  const params = useLocalSearchParams<{ employeeId: string }>();

  if (!params.employeeId) {
    return null;
  }

  return <EmployeeFormScreen mode="edit" employeeId={params.employeeId} />;
}
