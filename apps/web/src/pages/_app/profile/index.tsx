import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, KeyRound, UserRound } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import GoogleLogo from "@/assets/google-logo.png";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/app-context";
import { auth } from "@/hooks/auth";
import { router } from "@/router";
import { getInitials } from "@/utils/get-initials";

const ProfileSchema = z.object({
	name: z.string().trim().min(2, "Informe um nome com pelo menos 2 caracteres."),
	email: z.email(),
});

type ProfileFormData = z.infer<typeof ProfileSchema>;

const profileSearchSchema = z.object({
	googleLinked: z.enum(["true"]).optional(),
	googleSynced: z.enum(["true"]).optional(),
	googleError: z.string().optional(),
});

const ChangePasswordSchema = z
	.object({
		currentPassword: z
			.string()
			.min(6, "A senha atual deve ter pelo menos 6 caracteres."),
		newPassword: z
			.string()
			.min(6, "A nova senha deve ter pelo menos 6 caracteres."),
		confirmPassword: z
			.string()
			.min(6, "A confirmação de senha deve ter pelo menos 6 caracteres."),
	})
	.refine((data) => data.newPassword !== data.currentPassword, {
		path: ["newPassword"],
		message: "A nova senha deve ser diferente da senha atual.",
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		path: ["confirmPassword"],
		message: "A confirmação deve ser igual à nova senha.",
	});

type ChangePasswordFormData = z.infer<typeof ChangePasswordSchema>;

export const Route = createFileRoute("/_app/profile/")({
	component: ProfilePage,
	validateSearch: (search) => profileSearchSchema.parse(search),
});

function ProfilePage() {
	const { auth: currentUser } = useApp();
	const { googleLinked, googleSynced, googleError } = Route.useSearch();
	const queryClient = useQueryClient();

	const updateProfile = auth.useUpdateProfile();
	const changePassword = auth.useChangePassword();
	const googleLinkStatus = auth.useGoogleLinkStatus();
	const linkGoogleAccount = auth.useLinkGoogleAccount();
	const syncGoogleProfile = auth.useSyncGoogleProfile();

	const profileForm = useForm<ProfileFormData>({
		resolver: zodResolver(ProfileSchema),
		defaultValues: {
			name: currentUser?.name ?? "",
			email: currentUser?.email ?? "",
		},
	});

	const passwordForm = useForm<ChangePasswordFormData>({
		resolver: zodResolver(ChangePasswordSchema),
		defaultValues: {
			currentPassword: "",
			newPassword: "",
			confirmPassword: "",
		},
	});

	const profileName = useWatch({
		control: profileForm.control,
		name: "name",
	});

	useEffect(() => {
		profileForm.reset({
			name: currentUser?.name ?? "",
			email: currentUser?.email ?? "",
		});
	}, [currentUser?.email, currentUser?.name, profileForm]);

	useEffect(() => {
		if (!googleLinked && !googleSynced && !googleError) {
			return;
		}

		if (googleLinked) {
			toast.success("Conta Google vinculada com sucesso.");
		}

		if (googleSynced) {
			toast.success("Dados sincronizados com o Google.");
		}

		if (googleError) {
			toast.error(googleError);
		}

		void queryClient.invalidateQueries({
			queryKey: ["session"],
		});

		void queryClient.invalidateQueries({
			queryKey: ["google-link-status"],
		});

		void router.navigate({
			to: "/profile",
			replace: true,
		});
	}, [googleError, googleLinked, googleSynced, queryClient]);

	const handleUpdateProfile = profileForm.handleSubmit(async (data) => {
		await updateProfile.mutateAsync({
			name: data.name.trim(),
		});
	});

	const handleChangePassword = passwordForm.handleSubmit(async (data) => {
		await changePassword.mutateAsync({
			currentPassword: data.currentPassword,
			newPassword: data.newPassword,
		});
	});

	const isGoogleLinked = googleLinkStatus.data?.isLinked ?? false;
	const isGoogleActionPending =
		linkGoogleAccount.isPending || syncGoogleProfile.isPending;

	const handleGoogleAction = () => {
		if (isGoogleLinked) {
			syncGoogleProfile.mutate();
			return;
		}

		linkGoogleAccount.mutate();
	};

	const nameForInitials = profileName || currentUser?.name || "Usuário";

	return (
		<main className="w-full max-w-4xl space-y-6">
			<header className="space-y-1">
				<h1 className="text-2xl font-semibold">Meu perfil</h1>
				<p className="text-muted-foreground text-sm">
					Gerencie os dados da sua conta e altere a senha de acesso.
				</p>
			</header>

			<Card>
				<CardHeader>
					<CardTitle>Dados do perfil</CardTitle>
					<CardDescription>
						Atualize seu nome. O e-mail é somente leitura.
					</CardDescription>
				</CardHeader>

				<CardContent className="space-y-5">
					<div className="flex items-center gap-3">
						<Avatar className="size-14">
							<AvatarImage src={currentUser?.avatarUrl ?? undefined} />
							<AvatarFallback>{getInitials(nameForInitials)}</AvatarFallback>
						</Avatar>
						<div className="space-y-0.5">
							<p className="text-sm font-medium">{currentUser?.name ?? "Usuário"}</p>
							<p className="text-muted-foreground text-xs">{currentUser?.email}</p>
						</div>
					</div>

					<form onSubmit={handleUpdateProfile} className="space-y-4">
						<FieldGroup>
							<Controller
								name="name"
								control={profileForm.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid} className="gap-1">
										<FieldLabel htmlFor="profile-name">Nome</FieldLabel>
										<div className="relative">
											<UserRound className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
											<Input
												id="profile-name"
												{...field}
												value={field.value ?? ""}
												placeholder="Seu nome"
												className="pl-9"
												aria-invalid={fieldState.invalid}
											/>
										</div>
										<FieldError errors={[fieldState.error]} />
									</Field>
								)}
							/>

							<Controller
								name="email"
								control={profileForm.control}
								render={({ field }) => (
									<Field className="gap-1">
										<FieldLabel htmlFor="profile-email">E-mail</FieldLabel>
										<div className="relative">
											<Eye className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
											<Input
												id="profile-email"
												{...field}
												value={field.value ?? ""}
												className="pl-9"
												disabled
												readOnly
											/>
										</div>
									</Field>
								)}
							/>
						</FieldGroup>

						<div className="flex justify-end">
							<Button
								type="submit"
								disabled={updateProfile.isPending}
								className="min-w-40"
							>
								{updateProfile.isPending ? "Salvando..." : "Salvar perfil"}
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Conta Google</CardTitle>
					<CardDescription>
						Vincule sua conta Google para login social e sincronize nome/avatar.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex items-center gap-3 rounded-lg border px-3 py-2">
						<img src={GoogleLogo} alt="Google" className="size-6" />
						<div className="space-y-0.5">
							<p className="text-sm font-medium">Google</p>
							<p className="text-muted-foreground text-xs">
								{googleLinkStatus.isPending
									? "Verificando vínculo..."
									: isGoogleLinked
										? "Conta vinculada"
										: "Conta não vinculada"}
							</p>
						</div>
					</div>

					<div className="flex justify-end">
						<Button
							type="button"
							variant="outline"
							onClick={handleGoogleAction}
							disabled={googleLinkStatus.isPending || isGoogleActionPending}
						>
							{isGoogleActionPending
								? "Redirecionando..."
								: isGoogleLinked
									? "Sincronizar dados do Google"
									: "Vincular conta Google"}
						</Button>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Segurança</CardTitle>
					<CardDescription>
						Altere sua senha. Após salvar, você precisará entrar novamente.
					</CardDescription>
				</CardHeader>

				<CardContent>
					<form onSubmit={handleChangePassword} className="space-y-4">
						<FieldGroup>
							<Controller
								name="currentPassword"
								control={passwordForm.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid} className="gap-1">
										<FieldLabel htmlFor="profile-current-password">
											Senha atual
										</FieldLabel>
										<div className="relative">
											<KeyRound className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
											<Input
												id="profile-current-password"
												{...field}
												type="password"
												className="pl-9"
												placeholder="Informe sua senha atual"
												aria-invalid={fieldState.invalid}
											/>
										</div>
										<FieldError errors={[fieldState.error]} />
									</Field>
								)}
							/>

							<Controller
								name="newPassword"
								control={passwordForm.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid} className="gap-1">
										<FieldLabel htmlFor="profile-new-password">
											Nova senha
										</FieldLabel>
										<div className="relative">
											<KeyRound className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
											<Input
												id="profile-new-password"
												{...field}
												type="password"
												className="pl-9"
												placeholder="Mínimo de 6 caracteres"
												aria-invalid={fieldState.invalid}
											/>
										</div>
										<FieldError errors={[fieldState.error]} />
									</Field>
								)}
							/>

							<Controller
								name="confirmPassword"
								control={passwordForm.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid} className="gap-1">
										<FieldLabel htmlFor="profile-confirm-password">
											Confirmar nova senha
										</FieldLabel>
										<div className="relative">
											<KeyRound className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
											<Input
												id="profile-confirm-password"
												{...field}
												type="password"
												className="pl-9"
												placeholder="Repita a nova senha"
												aria-invalid={fieldState.invalid}
											/>
										</div>
										<FieldError errors={[fieldState.error]} />
									</Field>
								)}
							/>
						</FieldGroup>

						<div className="flex justify-end">
							<Button
								type="submit"
								disabled={changePassword.isPending}
								className="min-w-40"
							>
								{changePassword.isPending ? "Atualizando..." : "Alterar senha"}
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</main>
	);
}
