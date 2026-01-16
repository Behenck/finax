import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDeleteEmployee } from "@/hooks/employees/use-delete-employee";
import type { Employee } from "@/schemas/types/employee";
import { Building2, Trash2 } from "lucide-react";
import { UpdateEmployee } from "./update-employee";

interface EmployeeCardProps {
  employee: Employee
}

export function EmployeeCard({ employee }: EmployeeCardProps) {
  const { mutateAsync: handleDeleteEmployee, isPending } = useDeleteEmployee()

  async function onDelete(employee: Employee) {
    const confirmed = window.confirm(`Deseja realmente excluir o Funcionário ${employee.name} ?`)
    if (!confirmed) return
    await handleDeleteEmployee(employee.id)
  }

  return (
    <Card className="px-6 py-4 rounded-lg flex-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-green-100 text-green-500">
            <Building2 className="size-5" />
          </div>

          <span className="font-medium ">{employee.name}</span>
        </div>

        <div className="flex items-center gap-1">
          <UpdateEmployee employee={employee} />

          <Button
            variant="ghost"
            size="icon"
            disabled={isPending}
            onClick={() => onDelete(employee)}
          >
            <Trash2 className='text-red-600' />
          </Button>
        </div>
      </div>
    </Card>
  )
}