import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import type { CostCenter } from "@/schemas/types/cost-center";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { CostCenterForm } from "./cost-center-form";

interface UpdateCostCenterProps {
	costCenter: CostCenter;
}

export function UpdateCostCenter({ costCenter }: UpdateCostCenterProps) {
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="ghost" size="icon">
					<Pencil className="text-muted-foreground" />
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogTitle>Atualizar Centro de Custo</DialogTitle>
				<CostCenterForm
					onSuccess={() => setOpen(false)}
					mode="edit"
					initialData={costCenter}
				/>
			</DialogContent>
		</Dialog>
	);
}
