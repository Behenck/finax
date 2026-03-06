import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import type { Employee } from "@/schemas/types/employee";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { EmployeeForm } from "./employee-form";

interface UpdateEmployeeProps {
	employee: Employee;
}

export function UpdateEmployee({ employee }: UpdateEmployeeProps) {
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="ghost" size="icon">
					<Pencil className="text-gray-500" />
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
				<DialogTitle>Atualizar Funcionário</DialogTitle>
				<EmployeeForm
					onSuccess={() => setOpen(false)}
					mode="edit"
					initialData={employee}
				/>
			</DialogContent>
		</Dialog>
	);
}
