import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useState } from "react";
import { DialogTitle } from "@radix-ui/react-dialog";
import { UnitForm } from "./unit-form";

interface CreateUnitProps {
	companyId: string;
}

export function CreateUnit({ companyId }: CreateUnitProps) {
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="ghost" size="icon">
					<Plus className="text-gray-500" />
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogTitle>Nova Unidade</DialogTitle>
				<UnitForm onSuccess={() => setOpen(false)} companyId={companyId} />
			</DialogContent>
		</Dialog>
	);
}
