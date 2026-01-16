import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDeleteCostCenter } from "@/hooks/cost-centers/use-delete-cost-center";
import type { CostCenter } from "@/schemas/types/cost-center";
import { Building2, Trash2 } from "lucide-react";
import { CreateCostCenter } from "./create-cost-center";
import { UpdateCostCenter } from "./update-cost-center";

interface CostCenterCardProps {
  costCenter: CostCenter
}

export function CostCenterCard({ costCenter }: CostCenterCardProps) {
  const { mutateAsync: handleDeleteCostCenter, isPending } = useDeleteCostCenter()

  async function onDelete(costCenter: CostCenter) {
    const confirmed = window.confirm(`Deseja realmente excluir o Centro de Custo ${costCenter.name} ?`)
    if (!confirmed) return
    await handleDeleteCostCenter(costCenter.id)
  }

  return (
    <Card className="px-6 py-4 rounded-lg flex-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-green-100 text-green-500">
            <Building2 className="size-5" />
          </div>

          <span className="font-medium ">{costCenter.name}</span>
        </div>

        <div className="flex items-center gap-1">
          <UpdateCostCenter costCenter={costCenter} />

          <Button
            variant="ghost"
            size="icon"
            disabled={isPending}
            onClick={() => onDelete(costCenter)}
          >
            <Trash2 className='text-red-600' />
          </Button>
        </div>
      </div>
    </Card>
  )
}