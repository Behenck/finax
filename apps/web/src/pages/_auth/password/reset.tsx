import { createFileRoute, Link } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import z from "zod";
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { api } from "@/lib/axios";
import { Mail, Lock, Loader2, ArrowLeft } from "lucide-react";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { toast } from "sonner";
import { router } from "@/router";
import { normalizeApiError } from "@/errors/api-error";
import { resolveErrorMessage } from "@/errors";

const PasswordResetSchema = z
	.object({
		password: z
			.string()
			.min(6, { error: "A senha deve ter no mínimo 6 caracteres." }),
		confirmPassword: z
			.string()
			.min(6, {
				error: "A confirmação de senha deve ter no mínimo 6 caracteres.",
			}),
	})
	.refine((data) => data.password === data.confirmPassword, {
		path: ["confirmPassword"],
		message: "As senhas não conferem.",
	})
	.required();

export type PasswordResetType = z.infer<typeof PasswordResetSchema>;

const PasswordResetSearchSchema = z.object({
	token: z.string(),
});

export const Route = createFileRoute("/_auth/password/reset")({
	validateSearch: (search) => PasswordResetSearchSchema.parse(search),
	component: PasswordReset,
});

function PasswordReset() {
	const { token } = Route.useSearch();

	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [success, setSuccess] = useState<boolean>(false);

	useEffect(() => {
		toast.error("Token inválido");
		if (!token) router.navigate({ to: "/password/recover" });
	}, [token]);

	const onsSubmit = async (data: PasswordResetType) => {
		setIsLoading(true);

		try {
			const { confirmPassword, ...rest } = data;
			const payload = {
				code: token,
				...rest,
			};

			await api.post("/password/reset", payload);

			toast.success("Senha redefinida com sucesso!");

			router.navigate({ to: "/sign-in" });
			setSuccess(true);
		} catch (error) {
			toast.error(resolveErrorMessage(normalizeApiError(error)));
		} finally {
			setIsLoading(false);
		}
	};

	const { handleSubmit, control } = useForm<PasswordResetType>({
		resolver: zodResolver(PasswordResetSchema),
	});

	return (
		<form
			className="space-y-4 w-full max-w-sm"
			onSubmit={handleSubmit(onsSubmit)}
			noValidate
		>
			<div className="space-y-3 text-center mb-15">
				<div className="mx-auto bg-green-600 w-12 h-12 rounded-full flex items-center justify-center">
					<Lock className="mx-auto text-white" />
				</div>
				<h1 className="text-3xl font-semibold tracking-tight">
					Redefinir Senha
				</h1>
				<p className="text-sm text-muted-foreground">
					Digite sua nova senha para redefinir o acesso à sua conta.
				</p>
			</div>

			<FieldGroup>
				<Controller
					name="password"
					control={control}
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid} className="gap-1">
							<FieldLabel>Senha</FieldLabel>
							<div className="relative">
								<Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									{...field}
									className="pl-9"
									id="password"
									type="password"
									aria-invalid={fieldState.invalid}
									placeholder="Mínimo de 6 caracteres"
								/>
							</div>
							{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
						</Field>
					)}
				/>
			</FieldGroup>
			<FieldGroup>
				<Controller
					name="confirmPassword"
					control={control}
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid} className="gap-1">
							<FieldLabel>Confirme sua senha</FieldLabel>
							<div className="relative">
								<Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									{...field}
									className="pl-9"
									id="confirmPassword"
									type="password"
									aria-invalid={fieldState.invalid}
									placeholder="Confirme sua nova senha"
								/>
							</div>
							{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
						</Field>
					)}
				/>
			</FieldGroup>

			<div className="space-y-2">
				<Button
					className="w-full"
					disabled={isLoading || success}
					type="submit"
				>
					{isLoading ? (
						<span className="flex items-center justify-center gap-2">
							<Loader2 className="h-4 w-4 animate-spin" />
							Enviando...
						</span>
					) : success ? (
						"Redirecionando..."
					) : (
						"Redefinir Senha"
					)}
				</Button>

				<Button variant="outline" className="cursor-pointer w-full" asChild>
					<Link to="/sign-in">
						<ArrowLeft />
						Voltar ao login
					</Link>
				</Button>
			</div>
		</form>
	);
}
