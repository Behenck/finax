import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { CreateEmployee } from "./-components/create-employee";
import { EmployeeCard } from "./-components/employee-card";
import { createFileRoute } from "@tanstack/react-router";
import { useApp } from "@/context/app-context";
import { useGetOrganizationsSlugEmployees } from "@/http/generated";

export const Route = createFileRoute("/_app/registers/employees/")({
	component: Employees,
});

function Employees() {
	const { organization } = useApp()

	const [search, setSearch] = useState("");
	const { data, isLoading, isError } = useGetOrganizationsSlugEmployees({ slug: organization!.slug });

	const safeEmployees = data?.employees ?? [];

	const filteredEmployees = useMemo(() => {
		if (!search.trim()) return safeEmployees;

		const query = search.toLowerCase();

		return safeEmployees.filter((employees) => {
			const employeeMatch = employees.name.toLowerCase().includes(query);

			return employeeMatch;
		});
	}, [safeEmployees, search]);

	if (isLoading) return <h1>Carregando...</h1>;

	if (isError) {
		return <p className="text-destructive">Erro ao carregar funcionários.</p>;
	}

	return (
		<main className="w-full space-y-6">
			<header className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">Gerenciar Funcionários</h1>

				<CreateEmployee />
			</header>

			<div className="relative">
				<Search className="absolute left-5 top-1/2 -translate-1/2 size-4 text-gray-500" />
				<Input
					placeholder="Buscar por nome..."
					className="max-w-[40%] h-10 pl-10"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
			</div>

			<section className="space-y-4">
				{filteredEmployees?.map((employee) => (
					<EmployeeCard employee={employee} />
				))}
			</section>
		</main>
	);
}
