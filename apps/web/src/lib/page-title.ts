const APP_TITLE = "Finax";

type SearchRecord = Record<string, unknown>;

const ROUTE_TITLE_MATCHERS: Array<{
	pattern: RegExp;
	title: string;
}> = [
	{ pattern: /^\/sign-in\/?$/, title: "Login" },
	{ pattern: /^\/sign-out\/?$/, title: "Sair" },
	{ pattern: /^\/verify-otp\/?$/, title: "Verificação" },
	{ pattern: /^\/google\/callback\/?$/, title: "Login com Google" },
	{ pattern: /^\/password\/forgot\/?$/, title: "Esqueci minha senha" },
	{ pattern: /^\/password\/recover\/?$/, title: "Recuperar senha" },
	{ pattern: /^\/password\/reset\/?$/, title: "Redefinir senha" },
	{ pattern: /^\/invite(?:\/.*)?$/, title: "Convite" },
	{ pattern: /^\/profile\/?$/, title: "Perfil" },
	{ pattern: /^\/sales\/create\/?$/, title: "Nova venda" },
	{ pattern: /^\/sales\/quick-create\/?$/, title: "Venda rápida" },
	{ pattern: /^\/sales\/import\/?$/, title: "Importar vendas" },
	{ pattern: /^\/sales\/delinquency\/?$/, title: "Inadimplência" },
	{
		pattern: /^\/sales\/delinquency-import\/?$/,
		title: "Importar inadimplência",
	},
	{ pattern: /^\/sales\/update\/[^/]+\/?$/, title: "Editar venda" },
	{ pattern: /^\/sales\/[^/]+\/?$/, title: "Detalhes da venda" },
	{ pattern: /^\/sales\/?$/, title: "Vendas" },
	{ pattern: /^\/commissions\/bonus-preview\/?$/, title: "Prévia de bônus" },
	{ pattern: /^\/commissions\/?$/, title: "Comissões" },
	{ pattern: /^\/transactions\/create\/?$/, title: "Nova transação" },
	{
		pattern: /^\/transactions\/update\/[^/]+\/?$/,
		title: "Editar transação",
	},
	{ pattern: /^\/transactions\/?$/, title: "Transações" },
	{
		pattern: /^\/registers\/customers\/create\/?$/,
		title: "Novo cliente",
	},
	{
		pattern: /^\/registers\/customers\/update\/?$/,
		title: "Editar cliente",
	},
	{
		pattern: /^\/registers\/customers\/[^/]+\/?$/,
		title: "Detalhes do cliente",
	},
	{ pattern: /^\/registers\/customers\/?$/, title: "Clientes" },
	{ pattern: /^\/registers\/sellers\/create\/?$/, title: "Novo vendedor" },
	{ pattern: /^\/registers\/sellers\/update\/?$/, title: "Editar vendedor" },
	{ pattern: /^\/registers\/sellers\/?$/, title: "Vendedores" },
	{ pattern: /^\/registers\/partners\/create\/?$/, title: "Novo parceiro" },
	{ pattern: /^\/registers\/partners\/update\/?$/, title: "Editar parceiro" },
	{ pattern: /^\/registers\/partners\/?$/, title: "Parceiros" },
	{ pattern: /^\/registers\/products\/?$/, title: "Produtos" },
	{ pattern: /^\/registers\/companies\/?$/, title: "Empresas" },
	{ pattern: /^\/registers\/cost-centers\/?$/, title: "Centro de custos" },
	{ pattern: /^\/registers\/categories\/?$/, title: "Categorias" },
	{ pattern: /^\/registers\/employees\/?$/, title: "Funcionários" },
	{ pattern: /^\/settings\/members\/?$/, title: "Membros" },
	{ pattern: /^\/settings\/organization\/?$/, title: "Organização" },
	{ pattern: /^\/settings\/?$/, title: "Configurações" },
];

function getDashboardTitle(search: SearchRecord) {
	if (search.dashboard === "operational") {
		return "Dashboard operacional";
	}

	if (search.dashboard === "partners") {
		return "Dashboard parceiros";
	}

	return "Dashboard comercial";
}

export function resolvePageTitle(pathname: string, search: SearchRecord = {}) {
	const routeTitle =
		pathname === "/"
			? getDashboardTitle(search)
			: ROUTE_TITLE_MATCHERS.find((matcher) => matcher.pattern.test(pathname))
					?.title;

	return routeTitle ? `${APP_TITLE} | ${routeTitle}` : APP_TITLE;
}
