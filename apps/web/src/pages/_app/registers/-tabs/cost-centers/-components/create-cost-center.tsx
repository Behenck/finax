import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus } from 'lucide-react'
import { useState } from "react";
import { CostCenterForm } from "./cost-center-form";

export function CreateCostCenter() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Novo Centro de Custo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Novo Centro de Custo</DialogTitle>
        <CostCenterForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
