import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	createFileRoute,
	Link,
	Navigate,
	useNavigate,
} from "@tanstack/react-router";
import { ArrowRight, Mail, Lock } from "lucide-react";
import z from "zod";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import LogoBranco from "@/assets/logo-finax-branco.png";
import { auth } from "@/hooks/auth";
import { toast } from "sonner";
import { normalizeApiError } from "@/errors/api-error";
import { resolveErrorMessage } from "@/errors";

const SignInSchema = z.object({
	email: z.email("Email inválido").min(1, "Email é obrigatório"),
	password: z
		.string({ error: "Senha é obrigatória" })
		.min(6, "A senha deve ter no mínimo 6 caracteres"),
});

export type SignInType = z.infer<typeof SignInSchema>;

const signInSearchSchema = z.object({
	email: z.string().optional(),
});

export const Route = createFileRoute("/_auth/sign-in")({
	component: SignIn,
	validateSearch: (search) => signInSearchSchema.parse(search),
	head: () => ({
		meta: [
			{
				title: "Login | Finax",
			},
		],
	}),
});

function SignIn() {
	const { email } = Route.useSearch();
	const signInMutation = auth.useSignIn();
	const { data: session, isPending: isSessionPending } = auth.useSession();

	const { handleSubmit, resetField, control } = useForm<SignInType>({
		resolver: zodResolver(SignInSchema as any),
		defaultValues: {
			email: email ?? "",
			password: "",
		},
	});

	async function onSubmit(data: SignInType) {
		try {
			await signInMutation.mutateAsync(data);
			toast.success("Login realizado com sucesso!");
		} catch (err) {
			const apiError = normalizeApiError(err);
			const message = resolveErrorMessage(apiError);

			console.error("API Error:", apiError);
			toast.error(message);
		}

		resetField("password");
	}

	if (!isSessionPending && session) {
		return <Navigate to="/" replace />;
	}

	return (
		<div className="w-full max-w-md space-y-8 animate-fade-in">
			<div className="lg:hidden flex items-center justify-center gap-3 mb-8">
				<div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center">
					<img src={LogoBranco} alt="Logo Finax" />
				</div>
			</div>
			<div className="text-center lg:text-left">
				<h2 className="text-2xl font-bold text-foreground">
					Bem-vindo de volta
				</h2>
				<p className="mt-2 text-muted-foreground">
					Entre com sua conta para acessar o sistema
				</p>
			</div>
			<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
				<FieldGroup>
					<Controller
						name="email"
						control={control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid} className="gap-1">
								<FieldLabel htmlFor="mail">E-mail</FieldLabel>
								<div className="relative">
									<Mail className="absolute left-5 top-1/2 -translate-1/2 size-4 text-gray-500" />
									<Input
										{...field}
										id="email"
										type="email"
										autoComplete="email"
										autoCapitalize="none"
										autoCorrect="off"
										aria-invalid={fieldState.invalid}
										aria-describedby={
											fieldState.invalid ? "email-error" : undefined
										}
										className="px-3 pl-10 py-2 h-10"
										placeholder="seu@email.com"
									/>
								</div>
								{fieldState.invalid && (
									<FieldError id="email-error" errors={[fieldState.error]} />
								)}
							</Field>
						)}
					/>
				</FieldGroup>
				<FieldGroup>
					<Controller
						name="password"
						control={control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid} className="gap-1">
								<FieldLabel htmlFor="password">Senha</FieldLabel>
								<div className="relative">
									<Lock className="absolute left-5 top-1/2 -translate-1/2 size-4 text-gray-500" />
									<Input
										{...field}
										id="password"
										type="password"
										autoComplete="current-password"
										autoCapitalize="none"
										autoCorrect="off"
										aria-invalid={fieldState.invalid}
										aria-describedby={
											fieldState.invalid ? "password-error" : undefined
										}
										className="px-3 pl-10 py-2 h-10"
										placeholder="************"
									/>
								</div>
								{fieldState.invalid && (
									<FieldError id="password-error" errors={[fieldState.error]} />
								)}
							</Field>
						)}
					/>
				</FieldGroup>
				<Button
					type="submit"
					className="w-full h-10 text-md flex items-center gap-3"
				>
					Entrar
					<ArrowRight className="size-5" />
				</Button>
				<p className="flex gap-2 items-center justify-center text-sm text-muted-foreground">
					Não tem uma conta?
					<Link
						className="text-primary font-medium hover:underline"
						to="/sign-up"
					>
						Cadastre-se
					</Link>
				</p>
			</form>
		</div>
	);
}
