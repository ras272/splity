"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import type { User } from "@supabase/supabase-js"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, UserIcon, FileText, Palette } from "lucide-react"
import { useTheme } from "next-themes"

interface UserProfileProps {
  className?: string
}

export default function UserProfile({ className }: UserProfileProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [initials, setInitials] = useState("?")
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const supabase = createClient()

  useEffect(() => {
    async function getUser() {
      setLoading(true)
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        setUser(user)

        if (user) {
          // Get user profile data
          const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

          // Set initials based on user metadata or profile data
          if (user.user_metadata?.first_name) {
            const firstName = user.user_metadata.first_name as string
            const lastName = (user.user_metadata.last_name as string) || ""
            setInitials(`${firstName.charAt(0)}${lastName.charAt(0) || ""}`)
          } else if (profile?.full_name) {
            const nameParts = profile.full_name.split(" ")
            setInitials(`${nameParts[0].charAt(0)}${nameParts.length > 1 ? nameParts[1].charAt(0) : ""}`)
          } else if (user.email) {
            setInitials(user.email.charAt(0).toUpperCase())
          }
        }
      } catch (error) {
        console.error("Error fetching user:", error)
      } finally {
        setLoading(false)
      }
    }

    getUser()
  }, [supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  if (loading) {
    return (
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-gray-400 to-gray-300 dark:from-gray-600 dark:to-gray-700 rounded-full blur opacity-0 group-hover:opacity-30 transition duration-300"></div>
        <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 text-gray-700 dark:text-gray-200 animate-pulse">
          <span className="text-sm font-medium">...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <button onClick={() => router.push("/login")} className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 to-emerald-300 dark:from-emerald-600 dark:to-emerald-700 rounded-full blur opacity-0 group-hover:opacity-30 transition duration-300"></div>
        <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-700 dark:to-emerald-800 text-emerald-700 dark:text-emerald-200">
          <span className="text-sm font-medium">?</span>
        </div>
      </button>
    )
  }

  const displayName = user.user_metadata?.first_name
    ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`
    : user.email

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="relative group cursor-pointer">
          <div className="absolute -inset-1 bg-gradient-to-r from-gray-400 to-gray-300 dark:from-gray-600 dark:to-gray-700 rounded-full blur opacity-0 group-hover:opacity-30 transition duration-300"></div>
          <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 text-gray-700 dark:text-gray-200 cursor-pointer shadow-sm hover:shadow transition-all">
            <span className="text-sm font-medium">{initials}</span>
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 mt-1 rounded-xl border border-emerald-100/20 dark:border-emerald-900/20"
      >
        <div className="flex items-center p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 mr-3">
            <span className="text-sm font-medium">{initials}</span>
          </div>
          <div>
            <p className="font-medium">{displayName}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator className="bg-emerald-100/20 dark:bg-emerald-900/20" />
        <DropdownMenuItem className="cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors duration-200 focus:bg-emerald-50 dark:focus:bg-emerald-900/20">
          <UserIcon className="mr-2 h-4 w-4" />
          <span>Perfil</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors duration-200 focus:bg-emerald-50 dark:focus:bg-emerald-900/20">
          <FileText className="mr-2 h-4 w-4" />
          <span>Exportar historial</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors duration-200 focus:bg-emerald-50 dark:focus:bg-emerald-900/20"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Palette className="mr-2 h-4 w-4" />
          <span>Cambiar tema</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-emerald-100/20 dark:bg-emerald-900/20" />
        <DropdownMenuItem
          className="cursor-pointer text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors duration-200 focus:bg-red-50 dark:focus:bg-red-900/10"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Cerrar sesión</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
