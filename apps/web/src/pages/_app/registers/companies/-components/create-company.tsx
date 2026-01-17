import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus } from 'lucide-react'
import { useState } from "react";
import { CompanyForm } from "./company-form";
import { DialogTitle } from "@radix-ui/react-dialog";

export function CreateCompany() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Nova Empresa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Nova Empresa</DialogTitle>
        <CompanyForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
