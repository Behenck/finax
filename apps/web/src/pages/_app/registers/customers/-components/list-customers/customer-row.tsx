import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Edit3, EllipsisVertical, Mail, MessageCircle, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Link } from '@tanstack/react-router'
import { useDeleteOrganizationsSlugCustomersCustomerid, type GetOrganizationsSlugCustomers200 } from '@/http/generated'
import { getInitials } from '@/utils/get-initials'
import { formatPhone } from '@/utils/format-phone'
import { useApp } from '@/context/app-context'
import { toast } from 'sonner'
import { queryClient } from '@/lib/react-query'

interface CustomerRowProps {
  customer: GetOrganizationsSlugCustomers200["customers"][number]
}

export function CustomerRow({ customer }: CustomerRowProps) {
  const { organization } = useApp()
  const { mutateAsync: deleteCustomer } = useDeleteOrganizationsSlugCustomersCustomerid()

  async function handleDeleteCustomer(customer: CustomerRowProps["customer"]) {
    try {
      await deleteCustomer({
        slug: organization!.slug,
        customerId: customer.id
      })

      // ✅ opção A: invalidate (refetch)
      // Se você tiver o helper do queryKey:
      // await queryClient.invalidateQueries({ queryKey: getGetOrganizationsSlugCustomersQueryKey({ slug: organization!.slug }) })

      // ✅ opção B: invalidate genérico (depende do formato do queryKey do gerador)
      await queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes("organizations") && q.queryKey.includes("customers"),
      })

      toast.success(`Cliente ${customer.name} excluído com sucesso!`)
    } catch (err) {
      toast.error("Ocorreu um erro ao deletar esse cliente")
    }
  }

  return (
    <Card className='p-4 flex flex-row items-center justify-between cursor-pointer'>
      <div className='flex gap-2 items-center'>
        <Checkbox className='w-5 h-5' />
        <Avatar>
          <AvatarImage />
          <AvatarFallback>{getInitials(customer.name ?? "")}</AvatarFallback>
        </Avatar>
        <span className='font-medium text-sm'>{customer.name}</span>
      </div>
      {(customer.phone || customer.email) && (
        <div className='flex items-center gap-6'>
          <Separator orientation='vertical' className='h-10!' />
          <div>
            {customer.phone && (
              <div className='flex items-center gap-2'>
                <MessageCircle className='w-3 h-3' />
                <span className='text-[10px] font-medium'>
                  {formatPhone(customer.phone)}
                </span>
              </div>
            )}
            {customer.email && (
              <div className='flex items-center gap-2'>
                <Mail className='w-3 h-3' />
                <span className='text-[10px] font-medium'>
                  {customer.email}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
      <div className='flex items-center'>
        <Button variant="link" className='text-muted-foreground text-xs hover:no-underline hover:text-foreground'>
          Adicionar Venda
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="link" className='text-muted-foreground'>
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link to="/" className='cursor-pointer'>
                  <div className='flex gap-4 items-center'>
                    <Edit3 className='size-3.5 text-foreground' />
                    <span className='font-light text-sm'>Editar</span>
                  </div>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className='flex gap-4 items-center'
                onClick={() => {
                  handleDeleteCustomer(customer)
                }}
              >
                <Trash2 className='size-3.5 text-foreground' />
                <span className='font-light text-sm'>Excluir</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  )
}