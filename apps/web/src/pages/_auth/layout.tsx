import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Shield, Zap } from "lucide-react";
import LogoBranco from "@/assets/logo-finax-branco.png";

export const Route = createFileRoute("/_auth")({
	component: AuthLayout,
});

function AuthLayout() {
	return (
		<div className="flex min-h-screen">
			<div className="hidden lg:flex lg:w-1/2 gradient-dark relative overflow-hidden">
				<div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHoiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9nPjwvc3ZnPg==')] opacity-50"></div>
				<div className="relative z-10 flex flex-col justify-between p-12 w-full">
					<div className="flex items-center gap-3 w-full">
						<div className="bg-green-500 rounded-xl w-10 h-10 gradient-brand flex items-center justify-center">
							<img src={LogoBranco} alt="Logo Finax" />
						</div>
						<span className="text-2xl font-bold text-white">
							Finax
						</span>
					</div>
					<div className="space-y-8">
						<h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
							Controle financeiro
							<span className="block text-primary">inteligente</span>
							para sua empresa
						</h1>
						<p className="text-lg text-white/70 max-w-md">
							Gerencie receitas, despesas, reembolsos e tenha uma visão completa
							do seu fluxo de caixa empresarial.
						</p>
						<div className="space-y-4">
							<div className="flex items-center gap-3 text-white/80">
								<div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
									<Shield className="size-4 text-primary" />
								</div>
								<span>Dados seguros e protegidos</span>
							</div>
							<div className="flex items-center gap-3 text-white/80">
								<div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
									<Zap className="size-4 text-primary" />
								</div>
								<span>Relatórios prontos para DRE</span>
							</div>
						</div>
					</div>
					<p className="text-sm text-white/50">
						© 2026 Finax. Todos os direitos reservados.
					</p>
				</div>
			</div>
			<div className="flex flex-1 items-center justify-center bg-background px-4 py-6 sm:p-8">
				<Outlet />
			</div>
		</div>
	);
}
