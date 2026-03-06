import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useState } from "react";
import { EmployeeForm } from "./employee-form";

export function CreateEmployee() {
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button>
					<Plus />
					Novo Funcionário
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
				<DialogTitle>Novo Funcionário</DialogTitle>
				<EmployeeForm onSuccess={() => setOpen(false)} />
			</DialogContent>
		</Dialog>
	);
}
