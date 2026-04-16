import { createFileRoute, Link } from "@tanstack/react-router";
import z from "zod";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { api } from "@/lib/axios";
import { Mail, Loader2, MessageCircleQuestionMark } from "lucide-react";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { router } from "@/router";
import { normalizeApiError } from "@/errors/api-error";
import { resolveErrorMessage } from "@/errors";

const PasswordRecoverySchema = z
	.object({
		email: z.email({ error: "Email inválido!" }),
	})
	.required();

export type PasswordRecoveryType = z.infer<typeof PasswordRecoverySchema>;

const PasswordRecoverSearchSchema = z.object({
	email: z.string().optional(),
});

export const Route = createFileRoute("/_auth/password/recover")({
	validateSearch: (search) => PasswordRecoverSearchSchema.parse(search),
	component: PasswordRecover,
});

function PasswordRecover() {
	const { email: emailParam } = Route.useSearch();
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [success, setSuccess] = useState<boolean>(false);

	const { handleSubmit, control, watch } = useForm<PasswordRecoveryType>({
		resolver: zodResolver(PasswordRecoverySchema),
		defaultValues: {
			email: emailParam ?? "",
		},
	});

	const email = watch("email");

	const onsSubmit = async (data: PasswordRecoveryType) => {
		setIsLoading(true);

		try {
			await api.post("/password/recover", data);

			toast.success("Email de redefinição de senha enviado com sucesso!");

			router.navigate({ to: `/password/forgot?email=${email}` });
			setSuccess(true);
		} catch (error) {
			toast.error(resolveErrorMessage(normalizeApiError(error)));
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<form
			className="space-y-4 w-full max-w-sm"
			onSubmit={handleSubmit(onsSubmit)}
			noValidate
		>
			<div className="space-y-3 text-center">
				<div className="mx-auto bg-green-600 w-12 h-12 rounded-full flex items-center justify-center">
					<MessageCircleQuestionMark className="mx-auto text-white" />
				</div>
				<h1 className="text-3xl font-semibold tracking-tight">
					Esqueci minha senha
				</h1>
				<p className="text-sm text-muted-foreground">
					Digite seu email para receber instruções de redefinição de senha.
				</p>
			</div>

			<FieldGroup>
				<Controller
					name="email"
					control={control}
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid}>
							<FieldLabel>Email</FieldLabel>
							<div className="relative">
								<Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									{...field}
									className="pl-9"
									id="email"
									aria-invalid={fieldState.invalid}
									placeholder="seuemail@exemplo.com"
								/>
							</div>
							{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
						</Field>
					)}
				/>
			</FieldGroup>

			<Button
				className="w-full hover:opacity-90 cursor-pointer"
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
					"Enviar instruções"
				)}
			</Button>

			<p className="text-sm text-muted-foreground text-center">
				Lembrou da senha?{" "}
				<Link to="/sign-in" className="font-medium hover:underline">
					Fazer login
				</Link>
			</p>
		</form>
	);
}
