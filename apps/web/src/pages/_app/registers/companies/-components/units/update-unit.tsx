import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { DialogTitle } from "@radix-ui/react-dialog";
import { UnitForm } from "./unit-form";
import type { Unit } from "@/schemas/types/unit";

interface UpdateUnitProps {
	companyId: string;
	unit: Unit;
}

export function UpdateUnit({ companyId, unit }: UpdateUnitProps) {
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="ghost" size="icon">
					<Pencil className="text-muted-foreground" />
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
				<DialogTitle>Atualizar Unidade</DialogTitle>
				<UnitForm
					onSuccess={() => setOpen(false)}
					mode="edit"
					companyId={companyId}
					initialData={unit}
				/>
			</DialogContent>
		</Dialog>
	);
}
