import { FieldError } from "@/components/field-error"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { useApp } from "@/context/app-context"
import { getOrganizationsSlugSellersQueryKey, usePostOrganizationsSlugSellers, usePutOrganizationsSlugSellersSellerid, type GetOrganizationsSlugSellersSellerid200 } from "@/http/generated"
import { router } from "@/router"
import { sellerSchema, type SellerForm } from "@/schemas/seller-schema"
import { formatDocument } from "@/utils/format-document"
import { formatPhone } from "@/utils/format-phone"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Controller, FormProvider, useForm } from "react-hook-form"
import { toast } from "sonner"

interface FormSellerProps {
  type?: "CREATE" | "UPDATE"
  seller?: GetOrganizationsSlugSellersSellerid200["seller"]
}

export function FormSeller({ type = "CREATE", seller }: FormSellerProps) {
  const { organization } = useApp()
  const queryClient = useQueryClient()

  const { mutateAsync: createSeller } =
    usePostOrganizationsSlugSellers()

  const { mutateAsync: updateSeller } =
    usePutOrganizationsSlugSellersSellerid()

  const form = useForm<SellerForm>({
    resolver: zodResolver(sellerSchema),
    defaultValues: {
      name: seller?.name ?? "",
      email: seller?.email ?? "",
      phone: formatPhone(
        seller?.phone ?? ""
      ),
      companyName: seller?.companyName ?? "",
      documentType: seller?.documentType ?? "CNPJ",
      document: formatDocument({
        type: seller?.documentType ?? "CNPJ",
        value: seller?.document ?? "",
      }),
      country: seller?.country ?? "BR",
      state: seller?.state ?? "RS",
      zipCode: seller?.zipCode ?? "",
      city: seller?.city ?? "",
      street: seller?.street ?? "",
      neighborhood: seller?.neighborhood ?? "",
      number: seller?.number ?? "",
      complement: seller?.complement ?? "",
    },
  })

  const {
    handleSubmit,
    register,
    control,
    watch,
    formState: { errors }
  } = form

  const documentType = watch("documentType")

  async function onSubmit(data: SellerForm) {
    try {
      if (type === "CREATE") {
        const response = await createSeller({
          slug: organization!.slug,
          data,
        }, {
          onSuccess: async () => {
            await queryClient.invalidateQueries({
              queryKey: getOrganizationsSlugSellersQueryKey({
                slug: organization!.slug,
              }),
            })
          },
        });

        toast.success("Vendedor cadastrado com sucesso")

        form.reset()

        router.navigate({
          to: "/registers/sellers/update",
          search: { sellerId: response.sellerId },
        })

        return
      }

      await updateSeller({
        slug: organization!.slug,
        sellerId: seller!.id,
        data,
      }, {
        onSuccess: async () => {
          await queryClient.invalidateQueries({
            queryKey: getOrganizationsSlugSellersQueryKey({
              slug: organization!.slug,
            }),
          })
        },
      });

      toast.success("Vendedor atualizado com sucesso")
    } catch (err) {
      console.log(err)
      toast.error("Erro ao salvar vendedor")
    }
  }

  return (
    <FormProvider {...form}>
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="flex gap-4">
          <FieldGroup>
            <Field className="gap-1">
              <FieldLabel>Nome do representante *</FieldLabel>
              <Input placeholder='Ex: João da Silva' {...register("name")} />
              <FieldError error={errors.name} />
            </Field>
          </FieldGroup>
          <FieldGroup>
            <Field className="gap-1">
              <FieldLabel>Empresa *</FieldLabel>
              <Input placeholder='Ex: Silva LTDA' {...register("companyName")} />
              <FieldError error={errors.companyName} />
            </Field>
          </FieldGroup>
        </div>
        <div className="flex gap-4">
          <FieldGroup>
            <Field className="gap-1">
              <FieldLabel>email *</FieldLabel>
              <Input placeholder='Ex: joao.silva@empresa.com' {...register("email")} />
              <FieldError error={errors.email} />
            </Field>
          </FieldGroup>
          <FieldGroup>
            <Field className="gap-1">
              <FieldLabel>Telefone para contato *</FieldLabel>
              <Controller
                control={control}
                name="phone"
                render={({ field, fieldState }) => (
                  <>
                    <Input
                      placeholder="(00) 00000-0000"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          formatPhone(
                            e.target.value,
                          )
                        )
                      }
                    />
                    <FieldError error={fieldState.error} />
                  </>
                )}
              />
            </Field>
          </FieldGroup>
        </div>
        <div className="flex gap-4">
          <FieldGroup className="w-40">
            <Field className="gap-1">
              <FieldLabel>Tipo de documento *</FieldLabel>
              <Controller
                name="documentType"
                control={control}
                render={({ field, fieldState }) => (
                  <>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="CPF">CPF</SelectItem>
                          <SelectItem value="CNPJ">CNPJ</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldError error={fieldState.error} />
                  </>
                )}
              />
            </Field>
          </FieldGroup>
          <FieldGroup className="flex-1">
            <Field className="gap-1">
              <FieldLabel>CNPJ / CPF *</FieldLabel>
              <Controller
                control={control}
                name="document"
                render={({ field, fieldState }) => (
                  <>
                    <Input
                      placeholder="00.000.000/0000-00"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          formatDocument({
                            type: documentType,
                            value: e.target.value,
                          })
                        )
                      }
                    />
                    <FieldError error={fieldState.error} />
                  </>
                )}
              />
            </Field>
          </FieldGroup>
        </div>
        <Separator />
        <div className="space-y-4">
          <h3 className='text-muted-foreground text-sm'>Endereço</h3>
          <div className="flex gap-4">
            <FieldGroup>
              <Field className="gap-1">
                <FieldLabel>CEP</FieldLabel>
                <Input placeholder='Ex: 00000-000' {...register("zipCode")} />
                <FieldError error={errors.zipCode} />
              </Field>
            </FieldGroup>
            <FieldGroup>
              <Field className="gap-1">
                <FieldLabel>País *</FieldLabel>
                <Controller
                  name="country"
                  control={control}
                  render={({ field, fieldState }) => (
                    <>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="BR">Brasil</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldError error={fieldState.error} />
                    </>
                  )}
                />
              </Field>
            </FieldGroup>
            <FieldGroup>
              <Field className="gap-1">
                <FieldLabel>Estado *</FieldLabel>
                <Controller
                  name="state"
                  control={control}
                  render={({ field, fieldState }) => (
                    <>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="RS">Rio Grande do Sul</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldError error={fieldState.error} />
                    </>
                  )}
                />
              </Field>
            </FieldGroup>
            <FieldGroup>
              <Field className="gap-1">
                <FieldLabel>Cidade</FieldLabel>
                <Input placeholder='Ex: Uruguaiana' {...register("city")} />
                <FieldError error={errors.city} />
              </Field>
            </FieldGroup>
          </div>
          <div className="flex gap-4">
            <FieldGroup>
              <Field className="gap-1">
                <FieldLabel>Bairro</FieldLabel>
                <Input placeholder='Ex: Centro' {...register("street")} />
                <FieldError error={errors.street} />
              </Field>
            </FieldGroup>
            <FieldGroup>
              <Field className="gap-1">
                <FieldLabel>Rua</FieldLabel>
                <Input placeholder='Ex: Av. Presidente' {...register("neighborhood")} />
                <FieldError error={errors.neighborhood} />
              </Field>
            </FieldGroup>
            <FieldGroup>
              <Field className="gap-1">
                <FieldLabel>Número</FieldLabel>
                <Input placeholder='Ex: 123' {...register("number")} />
                <FieldError error={errors.number} />
              </Field>
            </FieldGroup>
            <FieldGroup>
              <Field className="gap-1">
                <FieldLabel>Complemento</FieldLabel>
                <Input placeholder='Ex: Escritório' {...register("complement")} />
                <FieldError error={errors.complement} />
              </Field>
            </FieldGroup>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button type='button' variant="outline" asChild>
            <Link to="/registers/sellers">
              Cancelar
            </Link>
          </Button>
          <Button type='submit'>
            {type === "CREATE" ? (
              "Cadastrar Vendedor"
            ) : (
              "Atualizar Vendedor"
            )}
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}