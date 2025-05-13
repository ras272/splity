"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function InvitePage({ params }: { params: { token: string } }) {
  const token = params.token
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invitation, setInvitation] = useState<any>(null)
  const [group, setGroup] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    const checkInvitation = async () => {
      try {
        setLoading(true)

        // 1. Verificar si el usuario está autenticado
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser()

        if (!currentUser) {
          // Guardar el token en localStorage para usarlo después del login
          localStorage.setItem("pendingInviteToken", token)
          router.push(`/login?redirect=/invite/${token}`)
          return
        }

        setUser(currentUser)

        // 2. Obtener la invitación
        const { data: invitation, error: invitationError } = await supabase
          .from("invitations")
          .select("*")
          .eq("token", token)
          .single()

        if (invitationError || !invitation) {
          setError("La invitación no es válida o ha expirado.")
          setLoading(false)
          return
        }

        // 3. Verificar si la invitación ha expirado
        if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
          setError("La invitación ha expirado.")
          setLoading(false)
          return
        }

        // 4. Obtener información del grupo
        const { data: group, error: groupError } = await supabase
          .from("groups")
          .select("*")
          .eq("id", invitation.group_id)
          .single()

        if (groupError || !group) {
          setError("El grupo no existe o ha sido eliminado.")
          setLoading(false)
          return
        }

        // 5. Verificar si el usuario ya es miembro del grupo
        const { data: existingMember, error: memberError } = await supabase
          .from("group_members")
          .select("*")
          .eq("group_id", group.id)
          .eq("user_id", currentUser.id)
          .maybeSingle()

        if (existingMember) {
          setError("Ya eres miembro de este grupo.")
          setLoading(false)
          return
        }

        setInvitation(invitation)
        setGroup(group)
        setLoading(false)
      } catch (err) {
        console.error("Error checking invitation:", err)
        setError("Ha ocurrido un error al verificar la invitación.")
        setLoading(false)
      }
    }

    checkInvitation()
  }, [token, router, supabase])

  const handleJoinGroup = async () => {
    try {
      setJoining(true)

      // 1. Añadir usuario como miembro del grupo
      const { error: memberError } = await supabase.from("group_members").insert({
        group_id: group.id,
        user_id: user.id,
        role: "member",
      })

      if (memberError) throw memberError

      // 2. Marcar la invitación como usada - adaptándonos a la estructura de la tabla
      // Verificamos qué campos existen en la invitación para usar el formato correcto
      const updateData =
        invitation.status !== undefined
          ? { status: "used" }
          : { used: true, used_by: user.id, used_at: new Date().toISOString() }

      await supabase.from("invitations").update(updateData).eq("token", token)

      // 3. Redirigir al dashboard
      router.push(`/dashboard?group=${group.id}`)
    } catch (err) {
      console.error("Error joining group:", err)
      setError("Ha ocurrido un error al unirte al grupo.")
      setJoining(false)
    }
  }

  // Si está cargando, mostrar un indicador de carga
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full border-4 border-t-emerald-500 animate-spin"></div>
            </div>
            <p className="text-center mt-4">Verificando invitación...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Si hay un error, mostrar el mensaje de error
  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitación no válida</CardTitle>
            <CardDescription>No se pudo procesar tu invitación</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push("/dashboard")} className="w-full">
              Ir al Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Si la invitación es válida, mostrar la información del grupo y el botón para unirse
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md">
          <span className="text-xl font-medium">S</span>
        </div>
        <h1 className="text-3xl font-bold">Splity</h1>
        <p className="text-muted-foreground">Divide gastos con amigos fácilmente</p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <div className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl bg-${group.color}-100`}>
              <span>{group.emoji}</span>
            </div>
          </div>
          <CardTitle className="text-center">Invitación a grupo</CardTitle>
          <CardDescription className="text-center">
            Has sido invitado a unirte al grupo <span className="font-medium">{group.name}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center mb-6">
            {group.description || "Únete a este grupo para compartir gastos con amigos y familiares."}
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button onClick={handleJoinGroup} className="w-full" disabled={joining}>
            {joining ? "Uniéndose..." : "Unirse al grupo"}
          </Button>
          <Button variant="outline" onClick={() => router.push("/dashboard")} className="w-full">
            Cancelar
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
