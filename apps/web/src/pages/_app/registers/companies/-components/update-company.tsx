import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { CompanyForm } from "./company-form";
import { DialogTitle } from "@radix-ui/react-dialog";
import type { Company } from "@/schemas/types/company";

interface UpdateCompanyProps {
	company: Company;
}

export function UpdateCompany({ company }: UpdateCompanyProps) {
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="ghost" size="icon">
					<Pencil className="text-gray-500" />
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogTitle>Atualizar Empresa</DialogTitle>
				<CompanyForm
					onSuccess={() => setOpen(false)}
					mode="edit"
					initialData={company}
				/>
			</DialogContent>
		</Dialog>
	);
}
