import { createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Mail, Shield, TrendingUp, Zap, Lock } from 'lucide-react'

export const Route = createFileRoute('/_auth/sign-in')({
  component: SignIn,
})

function SignIn() {
  return (
    <div className='min-h-screen flex'>
      <div className='hidden lg:flex lg:w-1/2 gradient-dark relative overflow-hidden'>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHoiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9nPjwvc3ZnPg==')] opacity-50"></div>
        <div className='relative z-10 flex flex-col justify-between p-12 w-full'>
          <div className='flex items-center gap-3 w-full'>
            <div className='bg-green-500 rounded-xl w-10 h-10 gradient-brand flex items-center justify-center'>
              <TrendingUp className='text-white' />
            </div>
            <span className='text-2xl font-bold text-white'>Fluxo de Caixa</span>
          </div>
          <div className='space-y-8'>
            <h1 className='text-4xl xl:text-5xl font-bold text-white leading-tight'>
              Controle financeiro
              <span className="block text-primary">inteligente</span>
              para sua empresa
            </h1>
            <p className="text-lg text-white/70 max-w-md">Gerencie receitas, despesas, reembolsos e tenha uma visão completa do seu fluxo de caixa empresarial.</p>
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Shield />
                </div>
                <span>Dados seguros e protegidos</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Zap />
                </div>
                <span>Relatórios prontos para DRE</span>
              </div>
            </div>
          </div>
          <p className="text-sm text-white/50">© 2024 FluxoCaixa. Todos os direitos reservados.</p>
        </div>
      </div>
      <div className='flex-1 flex items-center justify-center p-8 bg-background'>
        <div className='w-full max-w-md space-y-8 animate-fade-in'>
          <div className='lg:hidden flex items-center justify-center gap-3 mb-8'>
            <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center">
              <TrendingUp className='text-white' />
            </div>
          </div>
          <div className="text-center lg:text-left">
            <h2 className="text-2xl font-bold text-foreground">Bem-vindo de volta</h2>
            <p className="mt-2 text-muted-foreground">Entre com sua conta para acessar o sistema</p>
          </div>
          <form className="space-y-6">
            <div className="space-y-2">
              <label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-sm font-medium text-foreground" htmlFor="email">
                E-mail
              </label>
              <div className="relative">
                <Mail />
                <input type="email" className="flex w-full rounded-md border px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm pl-10 h-12 bg-background border-border focus:border-primary focus:ring-primary/20" id="email" placeholder="seu@email.com" value="" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-sm font-medium text-foreground" htmlFor="password">Senha</label>
              <div className="relative">
                <Lock />
                <input type="password" className="flex w-full rounded-md border px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm pl-10 h-12 bg-background border-border focus:border-primary focus:ring-primary/20" id="password" placeholder="••••••••" value="" />
              </div>
            </div>
            <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&amp;_svg]:pointer-events-none [&amp;_svg]:size-4 [&amp;_svg]:shrink-0 px-4 py-2 w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all duration-200" type="submit">
              Entrar
              <ArrowRight />
            </button>
            <p className="text-center text-sm text-muted-foreground">Não tem uma conta? 
              <a className="text-primary font-medium hover:underline" href="/signup">Cadastre-se</a>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
