import { Loader2, Mail } from "lucide-react";

export function ValidatingInvite() {
  return (
    <div className="space-y-4 w-full max-w-md">
      <div className="mx-auto bg-green-600 w-12 h-12 rounded-full flex items-center justify-center">
        <Mail className="text-white" />
      </div>

      <div className="text-center">
        <h1 className="text-3xl font-bold">Validando Convite</h1>
        <span className="text-muted-foreground text-sm">
          Aguarde enquanto validamos seu convite...
        </span>
      </div>

      <div className="space-y-2 mt-10 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin w-6 h-6" />
        <span className="text-muted-foreground">Validando convite...</span>
      </div>
    </div>
  )
}