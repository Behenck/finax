import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDeleteEmployee } from "@/hooks/employees/use-delete-employee";
import type { Employee } from "@/schemas/types/employee";
import { Briefcase, Building2, Trash2 } from "lucide-react";
import { UpdateEmployee } from "./update-employee";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
          <Avatar>
            <AvatarImage />
            <AvatarFallback>DB</AvatarFallback>
          </Avatar>

          <div className="space-y-1">
            <span className="font-medium ">{employee.name}</span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-gray-500 text-xs">
                <Briefcase className="size-3" />
                <span>{employee.role}</span>
              </div>
              <div className="flex items-center gap-1 text-gray-500 text-xs">
                <Building2 className="size-3" />
                <span>{employee.department}</span>
              </div>
              <div className="flex items-center gap-1 text-gray-500 text-xs">
                <Briefcase className="size-3" />
                <span>{employee.email}</span>
              </div>
            </div>
          </div>
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
    </Card >
  )
}