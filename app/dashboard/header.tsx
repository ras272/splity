"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import UserProfile from "@/components/user-profile"
import { useTheme } from "next-themes"
import { createClient } from "@/utils/supabase/client"

interface HeaderProps {
  selectedGroupId: string
  groups: {
    id: string
    name: string
    emoji: string
    currency: string
    color: string
  }[]
  setSelectedGroupId: (id: string) => void
  setShowAddGroupDialog: (show: boolean) => void
}

export default function Header({ selectedGroupId, groups, setSelectedGroupId, setShowAddGroupDialog }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    async function getUser() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        setUser(user)
      } catch (error) {
        console.error("Error fetching user:", error)
      }
    }

    getUser()
  }, [supabase])

  const getGroupColor = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId)
    return group?.color || "emerald"
  }

  const getGroupEmoji = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId)
    return group?.emoji || "💰"
  }

  return (
    <header className="sticky top-0 z-10 backdrop-blur-md bg-background/70 dark:bg-background/60 border-b border-emerald-100/20 dark:border-emerald-900/20 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo y Nombre */}
        <div className="flex items-center gap-3">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full blur opacity-25 group-hover:opacity-40 transition duration-300"></div>
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md">
              <span className="text-sm font-medium">S</span>
            </div>
          </div>
          <span className="font-semibold text-lg tracking-tight">Splity</span>
        </div>

        {/* Controles */}
        <div className="flex items-center gap-5">
          {/* Tema */}
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-9 w-9 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all duration-200"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <span className="text-yellow-300">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              </span>
            ) : (
              <span className="text-indigo-900">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              </span>
            )}
          </Button>

          {/* Selector de Grupo */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`gap-2 border-${getGroupColor(selectedGroupId)}-200 dark:border-${getGroupColor(selectedGroupId)}-900/30 hover:bg-${getGroupColor(selectedGroupId)}-50 dark:hover:bg-${getGroupColor(selectedGroupId)}-900/20`}
              >
                <span>{getGroupEmoji(selectedGroupId)}</span>
                <span>{groups.find((g) => g.id === selectedGroupId)?.name || "Personal"}</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56">
              <div className="space-y-2">
                {groups.map((group) => (
                  <Button
                    key={group.id}
                    variant={selectedGroupId === group.id ? "secondary" : "ghost"}
                    className="w-full justify-start gap-2"
                    onClick={() => setSelectedGroupId(group.id)}
                  >
                    <span>{group.emoji}</span>
                    <span className="flex-1 text-left">{group.name}</span>
                    <span className="text-xs text-muted-foreground">{group.currency}</span>
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2"
                  onClick={() => setShowAddGroupDialog(true)}
                >
                  <span>➕</span>
                  <span>Nuevo grupo</span>
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Notificaciones */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-9 w-9 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all duration-200"
            >
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white animate-pulse-subtle">
                2
              </span>
              <span className="text-base">🔔</span>
            </Button>
          </div>

          {/* Usuario */}
          <UserProfile />
        </div>
      </div>
    </header>
  )
}
