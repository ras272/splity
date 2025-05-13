"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/utils/supabase/client"
import Header from "./header"
import { DialogTrigger } from "@/components/ui/dialog"
import { ArrowUpRight, ChevronLeft, Plus, RefreshCw, Zap, Info, Trash2, Pencil, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "@/hooks/use-toast"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useRouter } from "next/navigation"
import { updateBudget } from "./actions"
// import MonthlyStats from "./monthly-stats"

// Types
type TransactionType = "expense" | "loan" | "settlement"

interface Transaction {
  id: string
  title: string
  type: TransactionType
  amount: number
  date: Date
  paidBy: string
  paid_by?: string
  paid_to?: string
  splitBetween?: string[]
  note?: string
  tag?: string
  groupId: string
  splits?: TransactionSplit[]
  category?: string
  isNew?: boolean
  created_by: string
}

interface TransactionSplit {
  id: string
  transaction_id: string
  user_id: string
  amount: number
  created_at: string
}

interface Person {
  id: string
  name: string
  initials: string
}

interface Achievement {
  id: string
  title: string
  emoji: string
  description: string
}

interface FinancialTip {
  id: number
  text: string
  icon: string
}

interface ExpenseGroup {
  id: string
  name: string
  description?: string
  members: Person[]
  color: string
  emoji: string
  currency: string
  type: "PERSONAL" | "GROUP"
  monthly_budget?: number
}

interface MonthlyStats {
  totalExpenses: number
  transactionCount: number
  averageExpense: number
  expensesByCategory: Record<string, number>
  hasData: boolean
  totalSpent?: number
  averagePerPerson?: number
}

// Helper functions
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  })
    .format(amount)
    .replace("$", "")
}

const formatDate = (date: Date) => {
  return `May ${date.getDate()}`
}

// Greeting messages
const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return "Buenos días"
  if (hour < 18) return "Buenas tardes"
  return "Buenas noches"
}

const getRandomWelcomeMessage = () => {
  const messages = [
    "¡Tu dinero está bajo control!",
    "Tus finanzas lucen geniales hoy.",
    "¿Listo para administrar tus gastos?",
    "Mantén el equilibrio financiero.",
    "Organizando tus finanzas juntos.",
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

// Función para obtener el color del grupo
const getGroupColor = (groupId: string, groups: ExpenseGroup[]) => {
  const group = groups.find((g) => g.id === groupId)
  return group?.color || "emerald"
}

// Función para obtener el emoji del grupo
const getGroupEmoji = (groupId: string, groups: ExpenseGroup[]) => {
  const group = groups.find((g) => g.id === groupId)
  return group?.emoji || "💰"
}

// Get current month and year in Spanish
const getCurrentMonthYear = () => {
  const months = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ]
  const now = new Date()
  return `${months[now.getMonth()]} ${now.getFullYear()}`
}

// Función para formatear montos según la moneda del grupo
const formatAmount = (amount: number, currency: string) => {
  return new Intl.NumberFormat("es-PY", {
    style: "currency",
    currency: currency,
    maximumFractionDigits: currency === "PYG" ? 0 : 2,
    minimumFractionDigits: currency === "PYG" ? 0 : 2,
  }).format(amount)
}

// Actualizar la interfaz del grupo para incluir members
interface NewGroup {
  name: string
  description: string
  emoji: string
  color: string
  currency: string
  members: string[]
}

// Función para obtener el mensaje de bienvenida según el estado del grupo
const getWelcomeMessage = (transactions: Transaction[], selectedGroupId: string, groups: ExpenseGroup[]) => {
  const groupTransactions = transactions.filter(t => t.groupId === selectedGroupId)
  const selectedGroup = groups.find(g => g.id === selectedGroupId)
  
  if (groupTransactions.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <span>👋 ¡Bienvenido a Splity! Todavía no registraste ningún gasto en {selectedGroup?.name || 'este grupo'}. Empezá agregando tu primera transacción.</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span>📊 Todo listo. Revisá tus transacciones o agregá una nueva.</span>
    </div>
  )
}

// Función para obtener la fecha actual en español
const getCurrentDateInSpanish = () => {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  
  const now = new Date()
  const day = days[now.getDay()]
  const date = now.getDate()
  const month = months[now.getMonth()]
  const year = now.getFullYear()
  
  return `${day}, ${date} de ${month} de ${year}`
}

export default function Dashboard() {
  const router = useRouter()
  const supabase = createClient()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [groups, setGroups] = useState<ExpenseGroup[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [tips, setTips] = useState<FinancialTip[]>([])
  const [budget, setBudget] = useState<number | null>(null)
  const [isLoadingGroups, setIsLoadingGroups] = useState(true)
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true)
  const [isLoadingAchievements, setIsLoadingAchievements] = useState(true)
  const [isLoadingBudget, setIsLoadingBudget] = useState(true)
  const [selectedGroupId, setSelectedGroupId] = useState<string>("personal")
  const [showAddExpenseDialog, setShowAddExpenseDialog] = useState(false)
  const [showSettleUpDialog, setShowSettleUpDialog] = useState(false)
  const [showLoanDialog, setShowLoanDialog] = useState(false)
  const [showAddGroupDialog, setShowAddGroupDialog] = useState(false)
  const [randomTip, setRandomTip] = useState<FinancialTip>({ id: 0, text: "", icon: "" })
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false)
  const [splitAmount, setSplitAmount] = useState<number | null>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Agregar después de los otros estados
  const [isEditingBudget, setIsEditingBudget] = useState(false)
  const [editedBudget, setEditedBudget] = useState("0")
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteLink, setInviteLink] = useState("")

  // Agregar este nuevo estado después de los otros estados
  const [showDeleteGroupDialog, setShowDeleteGroupDialog] = useState(false)

  // Monthly statistics state
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>({
    totalExpenses: 0,
    transactionCount: 0,
    averageExpense: 0,
    expensesByCategory: {},
    hasData: false,
  })
  const [isLoadingStats, setIsLoadingStats] = useState(true)

  // Estado para el nuevo grupo
  const [newGroup, setNewGroup] = useState<NewGroup>({
    name: "",
    description: "",
    emoji: "🏠",
    color: "emerald",
    currency: "USD",
    members: ["You"]
  })

  // New expense state
  const [newExpense, setNewExpense] = useState<{
    title: string
    amount: string
    paidBy: string
    splitWith: string[]
    note: string
    groupId: string
    category: string
  }>({
    title: "",
    amount: "",
    paidBy: "You",
    splitWith: [],
    note: "",
    groupId: selectedGroupId,
    category: "Otros 🌀",
  })

  // New settlement state
  const [newSettlement, setNewSettlement] = useState({
    amount: "",
    paidTo: "Alex",
    groupId: selectedGroupId,
  })

  // New loan state
  const [newLoan, setNewLoan] = useState({
    amount: "",
    loanedTo: "Alex",
    note: "",
    groupId: selectedGroupId,
  })

  // Agregar estado para el diálogo de confirmación
  const [showDeleteTransactionDialog, setShowDeleteTransactionDialog] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null)

  // Check if user is authenticated
  useEffect(() => {
    async function getUser() {
      setLoading(true)
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        setUser(user)

        if (!user) {
          router.push("/login")
        }
      } catch (error) {
        console.error("Error fetching user:", error)
      } finally {
        setLoading(false)
      }
    }

    getUser()
  }, [supabase, router])

  // Actualizar el grupo seleccionado en los formularios cuando cambia
  useEffect(() => {
    setNewExpense((prev) => ({ ...prev, groupId: selectedGroupId }))
    setNewSettlement((prev) => ({ ...prev, groupId: selectedGroupId }))
    setNewLoan((prev) => ({ ...prev, groupId: selectedGroupId }))

    // Actualizar las personas disponibles según el grupo seleccionado
    const selectedGroup = groups.find((g) => g.id === selectedGroupId)
    if (selectedGroup) {
      const groupMembers = selectedGroup.members.filter((m) => m.name !== "You").map((m) => m.name)
      setNewExpense((prev) => ({
        ...prev,
        splitWith: groupMembers.length > 0 ? groupMembers : [],
        paidBy: "You",
      }))

      if (groupMembers.length > 0) {
        setNewSettlement((prev) => ({ ...prev, paidTo: groupMembers[0] }))
        setNewLoan((prev) => ({ ...prev, loanedTo: groupMembers[0] }))
      }
    }
  }, [selectedGroupId, groups])

  // Set random tip on load
  useEffect(() => {
    async function fetchGroups() {
      if (!user) return

      setIsLoadingGroups(true)
      try {
        // Obtener grupos a los que pertenece el usuario
        const { data: groupMembers, error: membersError } = await supabase
          .from("group_members")
          .select("group_id")
          .eq("user_id", user.id)

        if (membersError) throw membersError

        if (groupMembers.length === 0) {
          setGroups([
            {
              id: "personal",
              name: "Personal",
              members: [
                {
                  id: user.id,
                  name: user?.user_metadata?.first_name || "You",
                  initials: (user?.user_metadata?.first_name || "You").charAt(0),
                },
              ],
              color: "emerald",
              emoji: "💰",
              currency: "USD",
              type: "PERSONAL"
            },
          ])
          setIsLoadingGroups(false)
          return
        }

        const groupIds = groupMembers.map((member: { group_id: string }) => member.group_id)

        // Obtener detalles de los grupos
        const { data: groupsData, error: groupsError } = await supabase.from("groups").select("*").in("id", groupIds)

        if (groupsError) throw groupsError

        // Obtener miembros de cada grupo
        const groupsWithMembers = await Promise.all(
          groupsData.map(async (group: any) => {
            const { data: members, error: membersError } = await supabase
              .from("group_members")
              .select("user_id")
              .eq("group_id", group.id)

            if (membersError) throw membersError

            // Obtener detalles de los usuarios
            const memberIds = members.map((member: { user_id: string }) => member.user_id)
            const { data: profiles, error: profilesError } = await supabase
              .from("profiles")
              .select("*")
              .in("id", memberIds)

            if (profilesError) throw profilesError

            return {
              id: group.id,
              name: group.name,
              description: group.description,
              emoji: group.emoji || "🏠",
              color: group.color || "emerald",
              currency: group.currency || "USD",
              type: group.type || "GROUP",
              members: profiles.map((profile: any) => ({
                id: profile.id,
                name:
                  profile.id === user.id
                    ? user?.user_metadata?.first_name || "You"
                    : profile.full_name || `User ${profile.id.slice(0, 4)}`,
                initials: (profile.id === user.id
                  ? user?.user_metadata?.first_name || "You"
                  : profile.full_name || `User ${profile.id.slice(0, 4)}`
                ).charAt(0),
              })),
            }
          }),
        )

        // Añadir grupo personal siempre
        const allGroups = [
          {
            id: "personal",
            name: "Personal",
            members: [
              {
                id: user.id,
                name: user?.user_metadata?.first_name || "You",
                initials: (user?.user_metadata?.first_name || "You").charAt(0),
              },
            ],
            color: "emerald",
            emoji: "💰",
            currency: "USD",
            type: "PERSONAL"
          },
          ...groupsWithMembers,
        ]

        setGroups(allGroups)
      } catch (error) {
        console.error("Error fetching groups:", error)
        // Fallback a grupo personal
        setGroups([
          {
            id: "personal",
            name: "Personal",
            members: [
              {
                id: user.id,
                name: user?.user_metadata?.first_name || "You",
                initials: (user?.user_metadata?.first_name || "You").charAt(0),
              },
            ],
            color: "emerald",
            emoji: "💰",
            currency: "USD",
            type: "PERSONAL"
          },
        ])
      } finally {
        setIsLoadingGroups(false)
      }
    }

    fetchGroups()
  }, [user, supabase])

  // Cargar transacciones cuando cambia el grupo seleccionado
  useEffect(() => {
    async function fetchTransactions() {
      if (!user || !selectedGroupId) return

      setIsLoadingTransactions(true)
      try {
        // Si el grupo es "personal", necesitamos un manejo especial ya que no es un UUID
        if (selectedGroupId === "personal") {
          // Para el grupo personal, obtenemos las transacciones donde el usuario es el creador
          // y no están asociadas a ningún grupo específico o tienen group_id = null
          const { data, error } = await supabase
            .from("transactions")
            .select("*")
            .is("group_id", null)
            .eq("created_by", user.id)
            .order("created_at", { ascending: false })

          if (error) throw error

          // Obtenemos los splits asociados a estas transacciones
          const transactionIds = data.map((t: any) => t.id)
          let transactionSplits: TransactionSplit[] = []

          if (transactionIds.length > 0) {
            const { data: splitsData, error: splitsError } = await supabase
              .from("transaction_splits")
              .select("*")
              .in("transaction_id", transactionIds)

            if (splitsError) throw splitsError
            transactionSplits = splitsData || []

            console.log("Personal transactions splits:", transactionSplits)
          }

          // Mapear los datos desde Supabase al formato necesario
          const formattedTransactions = data.map((transaction: any) => {
            // Encontrar los splits de esta transacción
            const splits = transactionSplits.filter(
              (split: TransactionSplit) => split.transaction_id === transaction.id,
            )

            return {
              id: transaction.id,
              title: transaction.title,
              type: transaction.type as TransactionType,
              amount: transaction.amount,
              date: new Date(transaction.created_at),
              paidBy: transaction.paid_by,
              paid_by: transaction.paid_by,
              paid_to: transaction.paid_to,
              splitBetween: transaction.split_between,
              note: transaction.note,
              tag: transaction.tag,
              groupId: transaction.group_id || "personal",
              // Añadimos los splits para utilizarlos en los cálculos
              splits: splits,
              category: transaction.category,
              created_by: transaction.created_by,
            }
          })

          setTransactions(formattedTransactions)
        } else {
          // Para grupos normales, usamos el UUID del grupo
          const { data, error } = await supabase
            .from("transactions")
            .select("*")
            .eq("group_id", selectedGroupId)
            .order("created_at", { ascending: false })

          if (error) throw error

          // Obtenemos los splits asociados a estas transacciones
          const transactionIds = data.map((t: any) => t.id)
          let transactionSplits: TransactionSplit[] = []

          if (transactionIds.length > 0) {
            const { data: splitsData, error: splitsError } = await supabase
              .from("transaction_splits")
              .select("*")
              .in("transaction_id", transactionIds)

            if (splitsError) throw splitsError
            transactionSplits = splitsData || []

            console.log("Group transactions:", data)
            console.log("Group transaction splits:", transactionSplits)
            console.log("Current user ID:", user.id)
          }

          // Mapear los datos desde Supabase al formato necesario
          const formattedTransactions = data.map((transaction: any) => {
            // Encontrar los splits de esta transacción
            const splits = transactionSplits.filter(
              (split: TransactionSplit) => split.transaction_id === transaction.id,
            )

            return {
              id: transaction.id,
              title: transaction.title,
              type: transaction.type as TransactionType,
              amount: transaction.amount,
              date: new Date(transaction.created_at),
              paidBy: transaction.paid_by,
              paid_by: transaction.paid_by,
              paid_to: transaction.paid_to,
              paidBetween: transaction.split_between,
              note: transaction.note,
              tag: transaction.tag,
              groupId: transaction.group_id,
              // Añadimos los splits para utilizarlos en los cálculos
              splits: splits,
              category: transaction.category,
              created_by: transaction.created_by,
            }
          })

          setTransactions(formattedTransactions)
        }
      } catch (error) {
        console.error("Error fetching transactions:", error)
        setTransactions([])
      } finally {
        setIsLoadingTransactions(false)
      }
    }

    fetchTransactions()
  }, [user, selectedGroupId, supabase])

  // Cargar presupuesto del usuario
  useEffect(() => {
    async function fetchBudget() {
      if (!user) return

      setIsLoadingBudget(true)
      try {
        const { data, error } = await supabase.from("budgets").select("*").eq("user_id", user.id).single()

        if (error) {
          if (error.code === "PGRST116") {
            // Error de no encontrado
            setBudget(null)
          } else {
            throw error
          }
        } else {
          setBudget(data.amount)
          setEditedBudget(data.amount.toString())
        }
      } catch (error) {
        console.error("Error fetching budget:", error)
        setBudget(null)
      } finally {
        setIsLoadingBudget(false)
      }
    }

    fetchBudget()
  }, [user, supabase])

  // Cargar logros del usuario
  useEffect(() => {
    async function fetchAchievements() {
      if (!user) return

      setIsLoadingAchievements(true)
      try {
        // Obtener IDs de logros del usuario
        const { data: userAchievements, error: userAchievementsError } = await supabase
          .from("user_achievements")
          .select("achievement_id")
          .eq("user_id", user.id)

        if (userAchievementsError) throw userAchievementsError

        if (userAchievements.length === 0) {
          setAchievements([])
          setIsLoadingAchievements(false)
          return
        }

        const achievementIds = userAchievements.map((ua: any) => ua.achievement_id)

        // Obtener detalles de logros
        const { data: achievementsData, error: achievementsError } = await supabase
          .from("achievements")
          .select("*")
          .in("id", achievementIds)

        if (achievementsError) throw achievementsError

        setAchievements(
          achievementsData.map((achievement: any) => ({
            id: achievement.id,
            title: achievement.title,
            emoji: achievement.emoji,
            description: achievement.description,
          })),
        )
      } catch (error) {
        console.error("Error fetching achievements:", error)
        setAchievements([])
      } finally {
        setIsLoadingAchievements(false)
      }
    }

    fetchAchievements()
  }, [user, supabase])

  // Cargar tips financieros
  useEffect(() => {
    async function fetchTips() {
      try {
        const { data, error } = await supabase.from("financial_tips").select("*")

        if (error) throw error

        setTips(
          data.map((tip: { id: number; text: string; icon: string }) => ({
            id: tip.id,
            text: tip.text,
            icon: tip.icon,
          })),
        )

        // Establecer un tip aleatorio
        if (data.length > 0) {
          const randomIndex = Math.floor(Math.random() * data.length)
          setRandomTip(data[randomIndex])
        }
      } catch (error) {
        console.error("Error fetching tips:", error)
        setTips([])
      }
    }

    fetchTips()
  }, [supabase])

  // Load stats when selected group changes or transactions update
  useEffect(() => {
    calculateMonthlyStats()
  }, [selectedGroupId, transactions])

  // Filtrar transacciones por grupo seleccionado
  const filteredTransactions = transactions.filter((t) => t.groupId === selectedGroupId)

  // Obtener el grupo seleccionado
  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || groups[0]

  // Calculate totals para el grupo seleccionado
  const totalSpent = filteredTransactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0)

  const monthlyBudget = budget || 0
  const remaining = monthlyBudget - totalSpent
  const budgetPercentage = monthlyBudget > 0 ? Math.round((totalSpent / monthlyBudget) * 100) : 0

  // Cálculo real del balance basado en las transacciones
  const totalPaidByUser = filteredTransactions
    .filter((t) => t.type === "expense" && t.paid_by === user?.id)
    .reduce((sum, t) => sum + Number(t.amount), 0)

  // Calcular cuánto le corresponde pagar al usuario actual (de sus transaction_splits)
  const userSplitAmount = filteredTransactions
    .flatMap((t) => t.splits || [])
    .filter((split) => split.user_id === user?.id)
    .reduce((sum, split) => sum + Number(split.amount), 0)

  // Log para depuración
  console.log("User ID:", user?.id)
  console.log("Total paid by user:", totalPaidByUser)
  console.log("User split amount:", userSplitAmount)
  console.log("Filtered transactions:", filteredTransactions)

  // Si no hay splits, calculamos manualmente basados en split_between
  let calculatedSplitAmount = 0
  if (userSplitAmount === 0) {
    calculatedSplitAmount = filteredTransactions
      .filter((t) => {
        // Transacciones de tipo expense
        if (t.type !== "expense") return false

        // Que el usuario actual no haya pagado
        if (t.paid_by === user?.id) return false

        // Que el usuario esté en split_between
        const userFullName = user?.user_metadata?.full_name || ""
        return (
          t.splitBetween &&
          (t.splitBetween.includes(userFullName) ||
            t.splitBetween.includes("You") ||
            // Si hay un nombre parcial que coincida (por ej. "Jack" vs "Jack Green")
            t.splitBetween.some(
              (name) => userFullName.includes(name) || (name !== "You" && name.includes(userFullName)),
            ))
        )
      })
      .reduce((sum, t) => {
        const splitCount = t.splitBetween?.length || 1
        return sum + Number(t.amount) / splitCount
      }, 0)
    console.log("Calculated split amount (fallback):", calculatedSplitAmount)
  }

  // Balance = pagado - lo que le tocaba pagar
  const realBalance = totalPaidByUser - (userSplitAmount || calculatedSplitAmount)
  console.log("Real balance:", realBalance)

  // Usamos realBalance como balance principal
  const netBalance = realBalance

  // Variables de préstamos - usando un solo conjunto de variables
  const youLoaned = filteredTransactions
    .filter((t) => t.type === "loan" && t.paidBy === "You")
    .reduce((sum, t) => sum + t.amount, 0)

  const youBorrowed = filteredTransactions
    .filter((t) => t.type === "loan" && t.paidBy !== "You")
    .reduce((sum, t) => sum + t.amount, 0)

  const netLoans = youLoaned - youBorrowed

  // Variables adicionales para otros cálculos si son necesarias
  const loansGiven = filteredTransactions
    .filter((t) => t.type === "loan" && (t.paidBy === user?.id || t.paid_by === user?.id))
    .reduce((sum, t) => sum + t.amount, 0)

  const loansTaken = filteredTransactions
    .filter((t) => t.type === "loan" && t.paidBy !== user?.id && t.paid_by !== user?.id)
    .reduce((sum, t) => sum + t.amount, 0)

  const totalTransactions = filteredTransactions.length
  const totalSettlements = filteredTransactions.filter((t) => t.type === "settlement").length
  const settlementAmount = filteredTransactions
    .filter((t) => t.type === "settlement")
    .reduce((sum, t) => sum + t.amount, 0)

  // Get budget progress message
  const getBudgetProgressMessage = () => {
    if (budgetPercentage < 25) return `Estás al ${budgetPercentage}% de tu presupuesto mensual. ¡Excelente ritmo! 🔥`
    if (budgetPercentage < 50) return `Estás al ${budgetPercentage}% de tu presupuesto mensual. Buen ritmo 🔥`
    if (budgetPercentage < 75) return `Estás al ${budgetPercentage}% de tu presupuesto mensual. Vas bien 👍`
    if (budgetPercentage < 90) return `Estás al ${budgetPercentage}% de tu presupuesto mensual. Ten cuidado 👀`
    return `Estás al ${budgetPercentage}% de tu presupuesto mensual. ¡Casi al límite! ⚠️`
  }

  // Handle adding a new expense
  const handleAddExpense = async () => {
    if (!newExpense.title || !newExpense.amount || !user) return

    const amount = Number.parseFloat(newExpense.amount)
    if (isNaN(amount) || amount <= 0) return

    try {
      // Obtener el grupo seleccionado
      const group = groups.find(g => g.id === newExpense.groupId)
      
      // Crear transacción en Supabase
      const { data: newTransaction, error } = await supabase
        .from("transactions")
        .insert({
          title: newExpense.title,
          amount: amount,
          type: "expense",
          // Si es grupo personal, el pagador siempre es el usuario actual
          paid_by: group?.type === "PERSONAL" ? user.id : newExpense.paidBy,
          // Si es grupo personal, no hay split
          split_between: group?.type === "PERSONAL" ? [user.id] : [newExpense.paidBy, ...newExpense.splitWith],
          note: newExpense.note,
          tag: "expense",
          group_id: newExpense.groupId === "personal" ? null : newExpense.groupId,
          created_by: user.id,
          category: newExpense.category,
        })
        .select()
        .single()

      if (error) throw error

      // Añadir la nueva transacción al estado local con una marca para identificarla como nueva
      const formattedTransaction = {
        id: newTransaction.id,
        title: newTransaction.title,
        type: newTransaction.type as TransactionType,
        amount: newTransaction.amount,
        date: new Date(newTransaction.created_at),
        paidBy: newTransaction.paid_by,
        paid_by: newTransaction.paid_by,
        paid_to: newTransaction.paid_to,
        splitBetween: newTransaction.split_between,
        note: newTransaction.note,
        tag: newTransaction.tag,
        groupId: newTransaction.group_id,
        category: newTransaction.category,
        isNew: true, // Marca para animar la transacción
        created_by: newTransaction.created_by,
      }

      // Actualizar el estado con el nuevo gasto al principio (más reciente)
      setTransactions([formattedTransaction, ...transactions])
      
      setShowAddExpenseDialog(false)
      
      // Calculate split amount if expense is split
      if (newExpense.splitWith.length > 0) {
        const splitPeople = newExpense.splitWith.length + 1 // +1 for the person who paid
        const amountPerPerson = amount / splitPeople
        setSplitAmount(amountPerPerson)

        // Show toast with split information
        toast({
          title: "Gasto registrado correctamente",
          description: `Cada uno paga: $${amountPerPerson.toFixed(2)}`,
          duration: 3000,
        })
      } else {
        // Show success animation
        setShowSuccessAnimation(true)
        setTimeout(() => setShowSuccessAnimation(false), 2000)

        // Show toast
        toast({
          title: "Gasto registrado correctamente",
          description: "Tu gasto ha sido añadido al historial",
          duration: 3000,
        })
      }
      
      // Después de un tiempo, quitar la marca "isNew"
      setTimeout(() => {
        setTransactions((prevTransactions) => 
          prevTransactions.map((t) => 
            t.id === formattedTransaction.id ? { ...t, isNew: false } : t
          )
        )
      }, 8000) // Aumentado para dar más tiempo para ver la animación

      // Resetear el formulario
      setNewExpense({
        title: "",
        amount: "",
        paidBy: "You",
        splitWith: [],
        note: "",
        groupId: selectedGroupId,
        category: "Otros 🌀",
      })
    } catch (error) {
      console.error("Error adding expense:", error)
      toast({
        title: "Error",
        description: "No se pudo registrar el gasto. Inténtalo de nuevo.",
        duration: 3000,
      })
    }
  }

  // Handle settling up
  const handleSettleUp = async () => {
    if (!newSettlement.amount || !user) return

    const amount = Number.parseFloat(newSettlement.amount)
    if (isNaN(amount) || amount <= 0) return

    try {
      // Crear transacción en Supabase
      const { data: newTransaction, error } = await supabase
        .from("transactions")
        .insert({
          title: "Settlement",
          amount: amount,
          type: "settlement",
          paid_by: "You",
          tag: "settlement",
          group_id: newSettlement.groupId === "personal" ? null : newSettlement.groupId,
          created_by: user.id,
          paid_to: newSettlement.paidTo,
        })
        .select()
        .single()

      if (error) throw error

      // Añadir la nueva transacción al estado local
      const formattedTransaction = {
        id: newTransaction.id,
        title: newTransaction.title,
        type: newTransaction.type as TransactionType,
        amount: newTransaction.amount,
        date: new Date(newTransaction.created_at),
        paidBy: newTransaction.paid_by,
        paid_by: newTransaction.paid_by,
        paid_to: newTransaction.paid_to,
        splitBetween: newTransaction.split_between,
        note: newTransaction.note,
        tag: newTransaction.tag,
        groupId: newTransaction.group_id,
        created_by: newTransaction.created_by,
      }

      setTransactions([formattedTransaction, ...transactions])
      setShowSettleUpDialog(false)

      // Show success animation
      setShowSuccessAnimation(true)
      setTimeout(() => setShowSuccessAnimation(false), 2000)

      // Show toast
      toast({
        title: "Liquidación registrada",
        description: `Has pagado $${amount.toFixed(2)} a ${newSettlement.paidTo}`,
        duration: 3000,
      })

      setNewSettlement({
        amount: "",
        paidTo: "Alex",
        groupId: selectedGroupId,
      })
    } catch (error) {
      console.error("Error adding settlement:", error)
      toast({
        title: "Error",
        description: "No se pudo registrar la liquidación. Inténtalo de nuevo.",
        duration: 3000,
      })
    }
  }

  // Handle adding a new loan
  const handleAddLoan = async () => {
    if (!newLoan.amount || !user) return

    const amount = Number.parseFloat(newLoan.amount)
    if (isNaN(amount) || amount <= 0) return

    try {
      // Crear transacción en Supabase
      const { data: newTransaction, error } = await supabase
        .from("transactions")
        .insert({
          title: "Loan",
          amount: amount,
          type: "loan",
          paid_by: "You",
          note: newLoan.note,
          tag: "loan",
          group_id: newLoan.groupId === "personal" ? null : newLoan.groupId,
          created_by: user.id,
          loaned_to: newLoan.loanedTo,
        })
        .select()
        .single()

      if (error) throw error

      // Añadir la nueva transacción al estado local
      const formattedTransaction = {
        id: newTransaction.id,
        title: newTransaction.title,
        type: newTransaction.type as TransactionType,
        amount: newTransaction.amount,
        date: new Date(newTransaction.created_at),
        paidBy: newTransaction.paid_by,
        splitBetween: newTransaction.split_between,
        note: newTransaction.note,
        tag: newTransaction.tag,
        groupId: newTransaction.group_id,
        created_by: newTransaction.created_by,
      }

      setTransactions([formattedTransaction, ...transactions])
      setShowLoanDialog(false)

      // Show success animation
      setShowSuccessAnimation(true)
      setTimeout(() => setShowSuccessAnimation(false), 2000)

      // Show toast
      toast({
        title: "Préstamo registrado",
        description: `Has prestado $${amount.toFixed(2)} a ${newLoan.loanedTo}`,
        duration: 3000,
      })

      setNewLoan({
        amount: "",
        loanedTo: newLoan.loanedTo,
        note: "",
        groupId: selectedGroupId,
      })
    } catch (error) {
      console.error("Error adding loan:", error)
      toast({
        title: "Error",
        description: "No se pudo registrar el préstamo. Inténtalo de nuevo.",
        duration: 3000,
      })
    }
  }

  // Handle adding a new group
  const handleAddGroup = async () => {
    try {
      const { data: newGroupData, error: groupError } = await supabase
        .from("groups")
        .insert({
          name: newGroup.name,
          description: newGroup.description,
          emoji: newGroup.emoji,
          color: newGroup.color,
          currency: newGroup.currency,
          created_by: user.id,
        })
        .select()
        .single()

      if (groupError) throw groupError

      setShowAddGroupDialog(false)
      
      // Resetear el formulario
      setNewGroup({
        name: "",
        description: "",
        emoji: "🏠",
        color: "emerald",
        currency: "USD",
        members: ["You"]
      })

      // Añadir al usuario actual como miembro del grupo
      const { error: memberError } = await supabase.from("group_members").insert({
        group_id: newGroupData.id,
        user_id: user.id,
        role: "admin",
      })

      if (memberError) throw memberError

      // Añadir otros miembros si fueron seleccionados
      // Esto es simplificado ya que en realidad necesitarías buscar IDs de usuario
      // basados en nombres o emails

      // Crear el grupo en el estado local
      const newGroupObj: ExpenseGroup = {
        id: newGroupData.id,
        name: newGroupData.name,
        description: newGroupData.description,
        members: [
          {
            id: user.id,
            name: user?.user_metadata?.first_name || "You",
            initials: (user?.user_metadata?.first_name || "You").charAt(0),
          },
        ],
        color: newGroupData.color,
        emoji: newGroupData.emoji,
        currency: newGroupData.currency,
        type: "GROUP"
      }

      setGroups([...groups, newGroupObj])
      setSelectedGroupId(newGroupData.id)

      toast({
        title: "Grupo creado correctamente",
        description: `El grupo "${newGroup.name}" ha sido creado`,
        duration: 3000,
      })
    } catch (error) {
      console.error("Error creating group:", error)
      toast({
        title: "Error",
        description: "No se pudo crear el grupo",
        variant: "destructive",
      })
    }
  }

  // Agregar después de las otras funciones de manejo
  const handleGenerateInviteLink = async () => {
    if (!inviteEmail) return

    try {
      // Generamos un UUID para el token (compatible con la columna uuid)
      // Usar crypto.randomUUID() del navegador que es compatible con navegadores modernos
      const token = self.crypto?.randomUUID
        ? self.crypto.randomUUID()
        : // Fallback para navegadores que no soportan randomUUID
          "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0
            const v = c === "x" ? r : (r & 0x3) | 0x8
            return v.toString(16)
          })

      // Creamos el enlace de invitación
      const link = `${window.location.origin}/invite/${token}`

      // Log de la información que estamos enviando
      console.log("Datos de invitación a insertar:", {
        token,
        group_id: selectedGroupId,
        email: inviteEmail,
        invited_by: user?.id, // Cambiado de created_by a invited_by
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })

      // Guardamos la invitación en la base de datos
      const result = await supabase.from("invitations").insert({
        token,
        group_id: selectedGroupId,
        email: inviteEmail,
        invited_by: user?.id, // Cambiado de created_by a invited_by
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 días
      })

      // Log detallado del resultado completo
      console.log("Resultado completo de insert:", JSON.stringify(result, null, 2))

      if (result.error) {
        console.error("Error detallado:", {
          code: result.error.code,
          message: result.error.message,
          details: result.error.details,
          hint: result.error.hint,
        })
        throw result.error
      }

      setInviteLink(link)

      // Mostramos un toast de éxito
      toast({
        title: "Enlace generado",
        description: "El enlace de invitación ha sido generado correctamente",
        duration: 3000,
      })
    } catch (error) {
      console.error("Error generando invitación:", error)
      toast({
        title: "Error",
        description: "No se pudo generar la invitación. Inténtalo de nuevo.",
        duration: 3000,
      })
    }
  }

  // Función para actualizar presupuesto en Supabase
  const handleSaveBudget = async () => {
    const formData = new FormData()
    formData.append("amount", editedBudget)
    formData.append("groupId", selectedGroupId)

    const result = await updateBudget(formData)

    if (result.success) {
      // Actualizar el presupuesto en el estado local de grupos
      setGroups(prevGroups =>
        prevGroups.map(group =>
          group.id === selectedGroupId
            ? { ...group, monthly_budget: Number(editedBudget) }
            : group
        )
      )
      setBudget(Number(editedBudget))
      setIsEditingBudget(false)
      toast({
        title: "Presupuesto actualizado",
        description: "El presupuesto mensual ha sido actualizado correctamente.",
        duration: 3000,
      })
    } else {
      toast({
        title: "Error",
        description: "No se pudo actualizar el presupuesto. Inténtalo de nuevo.",
        duration: 3000,
        variant: "destructive",
      })
    }
  }

  // Get transaction icon
  const getTransactionIcon = (transaction: Transaction) => {
    switch (transaction.type) {
      case "loan":
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
            <Zap className="h-5 w-5 text-purple-500" />
          </div>
        )
      case "settlement":
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
            <RefreshCw className="h-5 w-5 text-blue-500" />
          </div>
        )
      case "expense":
        if (transaction.title === "Groceries") {
          return (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <span className="text-lg">🛒</span>
            </div>
          )
        } else if (transaction.title === "Electricity Bill") {
          return (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
              <span className="text-lg">⚡</span>
            </div>
          )
        } else if (transaction.title === "Internet") {
          return (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <span className="text-lg">🌐</span>
            </div>
          )
        } else {
          return (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
              <span className="text-lg">💰</span>
            </div>
          )
        }
      default:
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
            <span className="text-lg">💰</span>
          </div>
        )
    }
  }

  // Calculate monthly statistics
  const calculateMonthlyStats = () => {
    setIsLoadingStats(true)

    try {
      // Get current month transactions of type "expense"
      const now = new Date()
      const currentMonth = now.getMonth()
      const currentYear = now.getFullYear()

      const monthlyExpenses = transactions.filter(
        (tx) =>
          tx.type === "expense" &&
          tx.date.getMonth() === currentMonth &&
          tx.date.getFullYear() === currentYear &&
          tx.groupId === selectedGroupId,
      )

      // Calculate total expenses
      const totalExpenses = monthlyExpenses.reduce((sum, tx) => sum + tx.amount, 0)

      // Count transactions
      const transactionCount = monthlyExpenses.length

      // Calculate average expense
      const averageExpense = transactionCount > 0 ? totalExpenses / transactionCount : 0

      // Group expenses by category
      const expensesByCategory: Record<string, number> = {}

      monthlyExpenses.forEach((tx) => {
        // Usar la categoría o "Otros 🌀" si no hay categoría
        const category = tx.category || "Otros 🌀"

        if (expensesByCategory[category]) {
          expensesByCategory[category] += tx.amount
        } else {
          expensesByCategory[category] = tx.amount
        }
      })

      setMonthlyStats({
        totalExpenses,
        transactionCount,
        averageExpense,
        expensesByCategory,
        hasData: transactionCount > 0,
        totalSpent: totalExpenses,
        averagePerPerson: totalExpenses / (selectedGroup?.members.length || 1),
      })
    } catch (error) {
      console.error("Error calculating monthly stats:", error)
    } finally {
      setIsLoadingStats(false)
    }
  }

  // Get percentage for pie chart
  const getTagPercentage = (tagAmount: number) => {
    if (!monthlyStats.totalExpenses) return 0
    return Math.round((tagAmount / monthlyStats.totalExpenses) * 100)
  }

  // Agregar función para manejar la eliminación
  const handleDeleteTransaction = async () => {
    if (!transactionToDelete || !user) return

    try {
      // Verificar que el usuario sea el creador de la transacción
      if (transactionToDelete.created_by !== user.id) {
        toast({
          title: "Error",
          description: "No tienes permiso para eliminar esta transacción",
          variant: "destructive",
        })
        return
      }

      // Eliminar la transacción de Supabase
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", transactionToDelete.id)

      if (error) throw error

      // Actualizar el estado local
      setTransactions(transactions.filter(t => t.id !== transactionToDelete.id))
      setShowDeleteTransactionDialog(false)
      setTransactionToDelete(null)

      toast({
        title: "Transacción eliminada",
        description: "La transacción ha sido eliminada correctamente",
      })
    } catch (error) {
      console.error("Error al eliminar la transacción:", error)
      toast({
        title: "Error",
        description: "No se pudo eliminar la transacción",
        variant: "destructive",
      })
    }
  }

  // Actualizar el presupuesto cuando cambia el grupo seleccionado
  useEffect(() => {
    const selectedGroup = groups.find(g => g.id === selectedGroupId)
    if (selectedGroup) {
      setBudget(selectedGroup.monthly_budget || 0)
      setEditedBudget((selectedGroup.monthly_budget || 0).toString())
      setIsLoadingBudget(false)
    }
  }, [selectedGroupId, groups])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-500 mx-auto"></div>
          <p className="text-lg font-medium">Cargando...</p>
        </div>
      </div>
    )
  }

  // También mostrar carga si estamos cargando grupos (necesarios para la interfaz)
  if (isLoadingGroups) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-500 mx-auto"></div>
          <p className="text-lg font-medium">Cargando tus grupos...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes fadeInUp {
          from { 
            opacity: 0;
            transform: translateY(10px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeInDown {
          from { 
            opacity: 0;
            transform: translateY(-10px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slideInAndHighlight {
          0% { 
            transform: translateX(-20px); 
            background-color: rgba(16, 185, 129, 0.8);
          }
          20% { 
            transform: translateX(0);
            background-color: rgba(16, 185, 129, 0.6);
          }
          60% { 
            background-color: rgba(16, 185, 129, 0.4);
          }
          100% { 
            background-color: rgba(16, 185, 129, 0.1);
          }
        }
        
        @keyframes highlightNew {
          0% { background-color: rgba(16, 185, 129, 0.6); }
          50% { background-color: rgba(16, 185, 129, 0.3); }
          100% { background-color: transparent; }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-in-out;
        }
        
        @keyframes fadeInUp {
          from { 
            opacity: 0;
            transform: translateY(10px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeInDown {
          from { 
            opacity: 0;
            transform: translateY(-10px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes flashHighlight {
          0% { background-color: rgba(16, 185, 129, 0.25); }
          70% { background-color: rgba(16, 185, 129, 0.1); }
          100% { background-color: transparent; }
        }
        
        .animate-pulse-subtle {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
        }
        
        @keyframes strongPulse {
          0%, 100% { 
            background-color: rgba(16, 185, 129, 0.4);
            border-left-color: #10b981;
          }
          50% { 
            background-color: rgba(16, 185, 129, 0.7);
            border-left-color: #059669;
          }
        }
        
        .animate-strong-pulse {
          animation: strongPulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        .card-hover {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .card-hover:hover {
            transform: scale(1.02);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        
        @keyframes successCheck {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        .success-animation {
          animation: successCheck 0.5s ease-in-out;
        }
        
        @keyframes confetti {
          0% { transform: translateY(0) rotate(0); opacity: 1; }
          100% { transform: translateY(100px) rotate(360deg); opacity: 0; }
        }
        
        .confetti {
          position: absolute;
          width: 10px;
          height: 10px;
          background-color: var(--confetti-color);
          border-radius: 50%;
          animation: confetti 1s ease-out forwards;
        }

        @keyframes dialogFadeIn {
          from { 
            opacity: 0;
            transform: translateY(-10px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }

        [data-state="open"] .dialog-content {
          animation: dialogFadeIn 0.2s ease-out;
        }
      `}</style>
      <div className="flex min-h-screen flex-col bg-background/50 animate-fadeIn">
        {/* Success Animation */}
        {showSuccessAnimation && (
          <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50">
            <div className="success-animation bg-emerald-100 dark:bg-emerald-900 rounded-full p-8 shadow-lg">
              <Check className="h-16 w-16 text-emerald-500" />
            </div>
          </div>
        )}

        {/* Header Component */}
        <Header
          selectedGroupId={selectedGroupId}
          groups={groups}
          setSelectedGroupId={setSelectedGroupId}
          setShowAddGroupDialog={setShowAddGroupDialog}
        />

        {/* Main Content */}
        <div className="flex flex-1 flex-col md:flex-row max-w-7xl mx-auto w-full">
          {/* Main Dashboard */}
          <main className="flex-1 p-6">
            {/* Welcome Message */}
            <div className="mb-4 bg-gradient-to-r from-emerald-50 to-transparent dark:from-emerald-950/30 dark:to-transparent p-3 rounded-lg animate-fadeIn">
              <p className="text-lg font-medium">
                {getGreeting()}, {user?.user_metadata?.first_name || "Usuario"} {" "}
              </p>
              <div className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                {getWelcomeMessage(transactions, selectedGroupId, groups)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{getCurrentDateInSpanish()}</p>
            </div>

            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold flex items-center gap-2">
                  <span>{getGroupEmoji(selectedGroupId, groups)}</span>
                  <span>{groups.find((g) => g.id === selectedGroupId)?.name || "Personal"}</span>
                </h1>
                <p className="text-sm text-muted-foreground">
                  {groups.find((g) => g.id === selectedGroupId)?.description || "Manage your shared expenses"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowInviteDialog(true)}>
                  <Plus className="h-4 w-4" />
                  <span>Invitar a grupo</span>
                </Button>
                <Button variant="outline" size="sm" className="gap-1">
                  <ChevronLeft className="h-4 w-4" />
                  <span>Back to Home</span>
                </Button>
                {selectedGroupId !== "personal" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/10"
                    onClick={() => setShowDeleteGroupDialog(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Eliminar grupo</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Recent Transactions */}
            <Card className="mb-8 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 card-hover">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xl">Recent Transactions</CardTitle>
                <div className="flex gap-2">
                  <Dialog open={showAddExpenseDialog} onOpenChange={setShowAddExpenseDialog}>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        className="bg-emerald-500 hover:bg-emerald-600 transition-all duration-200 transform hover:scale-105"
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        Add Expense
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="dialog-content">
                      <DialogHeader>
                        <DialogTitle>Add Expense</DialogTitle>
                        <DialogDescription>Enter the details of your expense below.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-6 py-4">
                        <div className="flex items-center gap-3 rounded-lg border bg-emerald-50/50 p-3 text-sm">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100">
                            <span className="text-lg">💸</span>
                          </div>
                          <p className="text-muted-foreground">
                            Registra tus gastos compartidos y mantén un seguimiento claro de quién pagó qué.
                          </p>
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="title" className="text-sm font-medium">
                            Título
                          </Label>
                          <Input
                            id="title"
                            value={newExpense.title}
                            onChange={(e) => setNewExpense({ ...newExpense, title: e.target.value })}
                            placeholder="ej. Cena, Supermercado, Alquiler"
                            className="rounded-md border-muted-foreground/20 transition-all focus-visible:ring-emerald-500"
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="amount" className="text-sm font-medium">
                            Monto
                          </Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              id="amount"
                              value={newExpense.amount}
                              onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                              placeholder="0.00"
                              type="number"
                              className="pl-7 rounded-md border-muted-foreground/20 transition-all focus-visible:ring-emerald-500"
                            />
                          </div>
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="expenseGroup">Grupo</Label>
                          <Select
                            value={newExpense.groupId}
                            onValueChange={(value) => setNewExpense({ ...newExpense, groupId: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona un grupo" />
                            </SelectTrigger>
                            <SelectContent>
                              {groups.map((group) => (
                                <SelectItem key={group.id} value={group.id}>
                                  <div className="flex items-center gap-2">
                                    <span>{group.emoji}</span>
                                    <span>{group.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="expenseCategory" className="text-sm font-medium">
                            Categoría
                          </Label>
                          <Select
                            value={newExpense.category}
                            onValueChange={(value) => setNewExpense({ ...newExpense, category: value })}
                          >
                            <SelectTrigger className="rounded-md border-muted-foreground/20 transition-all focus:ring-emerald-500">
                              <SelectValue placeholder="Selecciona una categoría" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Comida 🍔">
                                <div className="flex items-center gap-2">
                                  <span>🍔</span>
                                  <span>Comida</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="Transporte 🚗">
                                <div className="flex items-center gap-2">
                                  <span>🚗</span>
                                  <span>Transporte</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="Servicios 💡">
                                <div className="flex items-center gap-2">
                                  <span>💡</span>
                                  <span>Servicios</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="Entretenimiento 🎮">
                                <div className="flex items-center gap-2">
                                  <span>🎮</span>
                                  <span>Entretenimiento</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="Otros 🌀">
                                <div className="flex items-center gap-2">
                                  <span>🌀</span>
                                  <span>Otros</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {selectedGroup?.type !== "PERSONAL" && (
                          <>
                            <div className="grid gap-2">
                              <Label htmlFor="paidBy">Pagado por</Label>
                              <Select
                                value={newExpense.paidBy}
                                onValueChange={(value) => setNewExpense({ ...newExpense, paidBy: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona quién pagó" />
                                </SelectTrigger>
                                <SelectContent>
                                  {selectedGroup?.members.map((person) => (
                                    <SelectItem key={person.id} value={person.name}>
                                      {person.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="grid gap-2">
                              <Label>Dividir con</Label>
                              <div className="flex flex-wrap gap-2">
                                {selectedGroup?.members
                                  .filter((person) => person.name !== newExpense.paidBy)
                                  .map((person) => (
                                    <Badge
                                      key={person.id}
                                      variant={newExpense.splitWith.includes(person.name) ? "default" : "outline"}
                                      className={`cursor-pointer px-3 py-1.5 text-sm transition-all hover:bg-emerald-100 hover:text-emerald-700 ${
                                        newExpense.splitWith.includes(person.name)
                                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                          : "bg-transparent"
                                      }`}
                                      onClick={() => {
                                        if (newExpense.splitWith.includes(person.name)) {
                                          setNewExpense({
                                            ...newExpense,
                                            splitWith: newExpense.splitWith.filter((p) => p !== person.name),
                                          })
                                        } else {
                                          setNewExpense({
                                            ...newExpense,
                                            splitWith: [...newExpense.splitWith, person.name],
                                          })
                                        }
                                      }}
                                    >
                                      {person.name}
                                    </Badge>
                                  ))}
                              </div>
                            </div>
                          </>
                        )}

                        <div className="grid gap-2">
                          <Label htmlFor="note" className="text-sm font-medium">
                            Nota (opcional)
                          </Label>
                          <Input
                            id="note"
                            value={newExpense.note}
                            onChange={(e) => setNewExpense({ ...newExpense, note: e.target.value })}
                            placeholder="Añade una nota"
                            className="rounded-md border-muted-foreground/20 transition-all focus-visible:ring-emerald-500"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddExpenseDialog(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleAddExpense}>Guardar</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={showSettleUpDialog} onOpenChange={setShowSettleUpDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-1">
                        <RefreshCw className="h-4 w-4" />
                        Settle Up
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="dialog-content">
                      <DialogHeader>
                        <DialogTitle>Settle Up</DialogTitle>
                        <DialogDescription>Record a payment you made to settle a debt.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="settleGroup">Grupo</Label>
                          <Select
                            value={newSettlement.groupId}
                            onValueChange={(value) => setNewSettlement({ ...newSettlement, groupId: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona un grupo" />
                            </SelectTrigger>
                            <SelectContent>
                              {groups.map((group) => (
                                <SelectItem key={group.id} value={group.id}>
                                  <div className="flex items-center gap-2">
                                    <span>{group.emoji}</span>
                                    <span>{group.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="settleAmount">Amount</Label>
                          <Input
                            id="settleAmount"
                            value={newSettlement.amount}
                            onChange={(e) => setNewSettlement({ ...newSettlement, amount: e.target.value })}
                            placeholder="0.00"
                            type="number"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="paidTo">Paid to</Label>
                          <Select
                            value={newSettlement.paidTo}
                            onValueChange={(value) => setNewSettlement({ ...newSettlement, paidTo: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select who you paid" />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedGroup?.members
                                .filter((person) => person.name !== "You")
                                .map((person) => (
                                  <SelectItem key={person.id} value={person.name}>
                                    {person.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowSettleUpDialog(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleSettleUp}>Save</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={showLoanDialog} onOpenChange={setShowLoanDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-1">
                        <Zap className="h-4 w-4" />
                        Loan
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="dialog-content">
                      <DialogHeader>
                        <DialogTitle>Record a Loan</DialogTitle>
                        <DialogDescription>Record money you borrowed or lent to someone.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="loanGroup">Grupo</Label>
                          <Select
                            value={newLoan.groupId}
                            onValueChange={(value) => setNewLoan({ ...newLoan, groupId: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona un grupo" />
                            </SelectTrigger>
                            <SelectContent>
                              {groups.map((group) => (
                                <SelectItem key={group.id} value={group.id}>
                                  <div className="flex items-center gap-2">
                                    <span>{group.emoji}</span>
                                    <span>{group.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="loanAmount">Amount</Label>
                          <Input
                            id="loanAmount"
                            value={newLoan.amount}
                            onChange={(e) => setNewLoan({ ...newLoan, amount: e.target.value })}
                            placeholder="0.00"
                            type="number"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Type</Label>
                          <div className="flex gap-2">
                            <Button variant="outline" className="flex-1">
                              I borrowed
                            </Button>
                            <Button className="flex-1">I lent</Button>
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="loanedTo">From/To</Label>
                          <Select
                            value={newLoan.loanedTo}
                            onValueChange={(value) => setNewLoan({ ...newLoan, loanedTo: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select person" />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedGroup?.members
                                .filter((person) => person.name !== "You")
                                .map((person) => (
                                  <SelectItem key={person.id} value={person.name}>
                                    {person.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="loanNote">Note (optional)</Label>
                          <Input
                            id="loanNote"
                            value={newLoan.note}
                            onChange={(e) => setNewLoan({ ...newLoan, note: e.target.value })}
                            placeholder="e.g. To be paid back by end of month"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowLoanDialog(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleAddLoan}>Save</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="px-0 pb-0 max-h-[600px] overflow-y-auto scrollbar-hide">
                {isLoadingTransactions ? (
                  <div className="p-6">
                    <div className="space-y-4">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center justify-between animate-pulse">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-muted"></div>
                            <div>
                              <div className="h-4 w-32 bg-muted rounded mb-2"></div>
                              <div className="h-3 w-48 bg-muted/70 rounded"></div>
                            </div>
                          </div>
                          <div className="h-4 w-12 bg-muted rounded"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                      <span className="text-3xl">{getGroupEmoji(selectedGroupId, groups)}</span>
                    </div>
                    <h3 className="text-lg font-medium mb-1">No hay transacciones</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Aún no hay transacciones en este grupo. Comienza añadiendo un gasto, préstamo o liquidación.
                    </p>
                    <Button className="mt-4" onClick={() => setShowAddExpenseDialog(true)}>
                      <Plus className="mr-1 h-4 w-4" />
                      Añadir gasto
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredTransactions.map((transaction, index) => (
                      <div
                        key={transaction.id}
                        className={`flex items-center justify-between px-6 py-5 hover:bg-muted/30 dark:hover:bg-muted/10 transition-all duration-300 ${
                          transaction.isNew ? "animate-strong-pulse border-l-4 border-emerald-500 bg-emerald-200 dark:bg-emerald-800/50" : ""
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          {getTransactionIcon(transaction)}
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{transaction.title}</h3>
                              {transaction.tag && (
                                <Badge variant="outline" className="text-xs">
                                  {transaction.tag}
                                </Badge>
                              )}
                            </div>
                            {/* Mostrar información de pago y split solo si NO es grupo personal */}
                            {selectedGroup?.type !== "PERSONAL" ? (
                              <>
                                {transaction.type === "loan" && (
                                  <p className="text-sm text-muted-foreground">{transaction.paidBy} loaned You • Loan</p>
                                )}
                                {transaction.type === "settlement" && (
                                  <p className="text-sm text-muted-foreground">
                                    {transaction.paidBy === "You" 
                                      ? `You paid ${transaction.paid_to}` 
                                      : transaction.paid_to === "You" 
                                        ? `${transaction.paidBy} paid You` 
                                        : `${transaction.paidBy} paid ${transaction.paid_to}`} • Settlement
                                  </p>
                                )}
                                {transaction.type === "expense" && (
                                  <p className="text-sm text-muted-foreground">
                                    Paid by {transaction.paidBy} • Split between {transaction.splitBetween?.join(", ")}
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                {transaction.category || "Sin categoría"} • {formatDate(transaction.date)}
                              </p>
                            )}
                            {transaction.note && (
                              <p className="text-xs text-muted-foreground">Note: {transaction.note}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="font-medium text-emerald-600">
                            {formatAmount(transaction.amount, selectedGroup?.currency || "USD")}
                          </p>
                          {transaction.created_by === user?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => {
                                setTransactionToDelete(transaction)
                                setShowDeleteTransactionDialog(true)
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Eliminar transacción</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Micro-achievements Section */}
            <Card className="mb-8 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-md">Tus logros financieros</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingAchievements ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 animate-pulse">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"></div>
                        <div className="h-4 w-32 bg-muted rounded"></div>
                      </div>
                    ))}
                  </div>
                ) : achievements.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <span className="text-2xl">🏆</span>
                    </div>
                    <h3 className="text-md font-medium mb-1">No tienes logros aún</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Continúa usando la aplicación para desbloquear logros financieros y seguir tu progreso.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {achievements.map((achievement) => (
                      <TooltipProvider key={achievement.id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all cursor-help">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                <span className="text-xl">{achievement.emoji}</span>
                              </div>
                              <p className="text-sm font-medium">{achievement.title}</p>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{achievement.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Financial Tip */}
            {randomTip && (
              <div className="rounded-lg border p-4 bg-blue-50/50 dark:bg-blue-950/20 mb-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                    <Info className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Tip financiero</p>
                    <p className="text-sm text-muted-foreground">
                      {randomTip.icon} {randomTip.text}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </main>

          {/* Sidebar */}
          <aside className="w-full border-l dark:border-l dark-border md:w-80 lg:w-96 bg-background/50">
            <div className="p-6 sticky top-16">
              <h2 className="mb-4 text-lg font-semibold">Balance Summary</h2>

              {/* Total Spent */}
              <div
                className="mb-6 rounded-xl bg-white p-5 shadow-sm dark:bg-card dark-card-bg animate-fadeIn"
                style={{ animationDelay: "100ms" }}
              >
                <p className="text-sm font-medium">Total Spent</p>
                <p className="text-3xl font-semibold text-emerald-500">{formatAmount(totalSpent, selectedGroup?.currency || "USD")}</p>
                <p className="text-xs text-muted-foreground">
                  Across {filteredTransactions.filter((t) => t.type === "expense").length} expenses
                </p>

                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-sm">Monthly Budget</p>
                    {isLoadingBudget ? (
                      <div className="h-5 w-16 animate-pulse bg-muted rounded"></div>
                    ) : isEditingBudget ? (
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                            {selectedGroup?.currency || "USD"}
                          </span>
                          <Input
                            value={editedBudget}
                            onChange={(e) => setEditedBudget(e.target.value)}
                            className="w-24 h-7 pl-12 py-1 text-sm rounded-md"
                            autoFocus
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <p className="text-sm">{formatAmount(budget || 0, selectedGroup?.currency || "USD")}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 rounded-full hover:bg-muted/80"
                          onClick={() => setIsEditingBudget(true)}
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                          <span className="sr-only">Edit budget</span>
                        </Button>
                      </div>
                    )}
                  </div>
                  <Progress value={(totalSpent / monthlyBudget) * 100} className="h-2 bg-gray-100" />

                  {isEditingBudget && (
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          setIsEditingBudget(false)
                          setEditedBudget(monthlyBudget.toString())
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 px-2 text-xs bg-emerald-500 hover:bg-emerald-600"
                        onClick={handleSaveBudget}
                      >
                        Guardar
                      </Button>
                    </div>
                  )}

                  {/* Budget Progress Message */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="mt-2 text-xs text-muted-foreground cursor-help flex items-center">
                          {formatAmount(remaining, selectedGroup?.currency || "USD")} remaining
                          <span className="ml-1 text-emerald-500">ℹ️</span>
                        </p>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        <p>{getBudgetProgressMessage()}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              <Separator className="my-6" />

              {/* Monthly Statistics */}
              <div
                className="mb-6 rounded-xl bg-white p-5 shadow-sm dark:bg-card dark-card-bg animate-fadeIn"
                style={{ animationDelay: "100ms" }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">Estadísticas mensuales</h3>
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                  >
                    {getCurrentMonthYear()}
                  </Badge>
                </div>

                {isLoadingTransactions ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-500"></div>
                    <p className="mt-2 text-sm text-muted-foreground">Calculando estadísticas...</p>
                  </div>
                ) : (
                  (() => {
                    // Obtener el mes y año actual
                    const now = new Date()
                    const currentMonth = now.getMonth()
                    const currentYear = now.getFullYear()

                    // Filtrar gastos del mes actual
                    const monthlyExpenses = filteredTransactions.filter(
                      (tx) =>
                        tx.type === "expense" &&
                        tx.date.getMonth() === currentMonth &&
                        tx.date.getFullYear() === currentYear,
                    )

                    // Calcular estadísticas básicas
                    const totalMonthlyExpenses = monthlyExpenses.reduce((sum, tx) => sum + tx.amount, 0)
                    const transactionCount = monthlyExpenses.length
                    const averageExpense = transactionCount > 0 ? totalMonthlyExpenses / transactionCount : 0

                    // Agrupar gastos por categoría
                    const expensesByCategory = {}
                    monthlyExpenses.forEach((tx) => {
                      // Usar la categoría o "Otros 🌀" si no hay categoría
                      const category = tx.category || "Otros 🌀"

                      if (expensesByCategory[category]) {
                        expensesByCategory[category] += tx.amount
                      } else {
                        expensesByCategory[category] = tx.amount
                      }
                    })

                    // Ordenar categorías por monto (de mayor a menor)
                    const categoryData = Object.entries(expensesByCategory)
                      .map(([category, amount]) => ({
                        category,
                        amount: Number(amount),
                        percentage: totalMonthlyExpenses > 0 ? (Number(amount) / totalMonthlyExpenses) * 100 : 0,
                      }))
                      .sort((a, b) => b.amount - a.amount)

                    // Si no hay transacciones, mostrar mensaje
                    if (transactionCount === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 mb-3">
                            <span className="text-lg">📊</span>
                          </div>
                          <p className="text-sm text-muted-foreground">Aún no hay estadísticas este mes.</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Registra gastos para ver las estadísticas.
                          </p>
                        </div>
                      )
                    }

                    // Si hay transacciones, mostrar estadísticas
                    return (
                      <>
                        <div className="mb-8">
                          <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-medium">Estadísticas mensuales</h3>
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                              {getCurrentMonthYear()}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {/* Gasto total */}
                            <div className="flex flex-col bg-white dark:bg-card rounded-xl p-6 shadow-sm">
                              <div className="flex items-start gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                                  <svg
                                    className="h-6 w-6 text-emerald-600 dark:text-emerald-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    strokeWidth="2"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.171-.879-1.171-2.303 0-3.182C10.582 7.72 11.35 7.5 12 7.5c.725 0 1.45.22 2.003.659" />
                                  </svg>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm text-muted-foreground mb-1">Gasto total</p>
                                  <div className="relative">
                                    <p className="text-2xl font-semibold truncate" title={formatAmount(totalMonthlyExpenses, selectedGroup?.currency || "USD")}>
                                      {formatAmount(totalMonthlyExpenses, selectedGroup?.currency || "USD")}
                                    </p>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">Acumulado este mes</p>
                                </div>
                              </div>
                            </div>

                            {/* Transacciones */}
                            <div className="flex flex-col bg-white dark:bg-card rounded-xl p-6 shadow-sm">
                              <div className="flex items-start gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                                  <svg
                                    className="h-6 w-6 text-blue-600 dark:text-blue-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    strokeWidth="2"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                                  </svg>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm text-muted-foreground mb-1">Transacciones</p>
                                  <div className="relative">
                                    <p className="text-2xl font-semibold truncate" title={transactionCount.toString()}>
                                      {transactionCount}
                                    </p>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">Movimientos del mes</p>
                                </div>
                              </div>
                            </div>

                            {/* Promedio */}
                            <div className="flex flex-col bg-white dark:bg-card rounded-xl p-6 shadow-sm">
                              <div className="flex items-start gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                                  <svg
                                    className="h-6 w-6 text-purple-600 dark:text-purple-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    strokeWidth="2"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
                                  </svg>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm text-muted-foreground mb-1">Promedio por gasto</p>
                                  <div className="relative">
                                    <p className="text-2xl font-semibold truncate" title={formatAmount(averageExpense, selectedGroup?.currency || "USD")}>
                                      {formatAmount(averageExpense, selectedGroup?.currency || "USD")}
                                    </p>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">Por transacción</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Distribución de gastos */}
                        {categoryData.length > 0 && (
                          <div className="bg-white dark:bg-card rounded-xl p-6 shadow-sm">
                            <h4 className="text-base font-medium mb-4">Distribución de gastos</h4>
                            <div className="space-y-4">
                              {categoryData.map(({ category, amount, percentage }) => {
                                const matches = category.match(/^(.*)\s+(\p{Emoji})$/u);
                                const categoryName = matches ? matches[1] : category;
                                const emoji = matches ? matches[2] : "🌀";
                                
                                return (
                                  <div key={category} className="flex items-center gap-4">
                                    <div className="w-28 truncate flex items-center gap-2" title={category}>
                                      <span className="text-base">{emoji}</span>
                                      <p className="text-sm font-medium">{categoryName}</p>
                                    </div>
                                    <div className="flex-1">
                                      <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800">
                                        <div
                                          className="h-2 rounded-full bg-emerald-500/70"
                                          style={{ width: `${Math.round(percentage)}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 min-w-[100px] justify-end">
                                      <p className="text-sm font-medium truncate" title={formatAmount(amount, selectedGroup?.currency || "USD")}>
                                        {formatAmount(amount, selectedGroup?.currency || "USD")}
                                      </p>
                                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                                        ({Math.round(percentage)}%)
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()
                )}
              </div>

              <Separator className="my-6" />

              {/* Your Balance */}
              <div
                className="mb-6 rounded-xl bg-white p-5 shadow-sm dark:bg-card dark-card-bg animate-fadeIn"
                style={{ animationDelay: "100ms" }}
              >
                <h3 className="mb-2 text-lg font-medium">Your Balance</h3>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm">Net Balance</p>
                  <p className={`text-sm font-medium ${netBalance < 0 ? "text-red-500" : "text-emerald-500"}`}>
                    {formatAmount(Math.abs(netBalance), selectedGroup?.currency || "USD")}
                  </p>
                </div>

                <div className="space-y-3">
                  {netBalance < 0 ? (
                    <div className="rounded-md bg-red-50 p-4 hover:bg-red-100/70 dark:bg-red-900/20 dark:hover:bg-red-900/30 transition-colors duration-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ArrowUpRight className="h-4 w-4 text-red-500" />
                          <p className="text-sm">Debés</p>
                        </div>
                        <p className="text-sm font-medium text-red-500">
                          {formatAmount(Math.abs(netBalance), selectedGroup?.currency || "USD")}
                        </p>
                      </div>
                    </div>
                  ) : netBalance > 0 ? (
                    <div className="rounded-md bg-emerald-50 p-4 hover:bg-emerald-100/70 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30 transition-colors duration-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                          <p className="text-sm">Te deben</p>
                        </div>
                        <p className="text-sm font-medium text-emerald-500">
                          {formatAmount(netBalance, selectedGroup?.currency || "USD")}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-md bg-emerald-50 p-4 dark:bg-emerald-900/20 transition-colors duration-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-500" />
                          <p className="text-sm">No debés nada en este grupo</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator className="my-6" />

              {/* Loans */}
              <div
                className="mb-6 rounded-xl bg-white p-5 shadow-sm dark:bg-card dark-card-bg animate-fadeIn"
                style={{ animationDelay: "100ms" }}
              >
                <h3 className="mb-2 text-lg font-medium">Loans</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm">You loaned</p>
                    <p className="text-sm font-medium text-emerald-500">
                      {formatAmount(youLoaned, selectedGroup?.currency || "USD")}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm">You borrowed</p>
                    <p className="text-sm font-medium text-red-500">
                      {formatAmount(youBorrowed, selectedGroup?.currency || "USD")}
                    </p>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Net loans</p>
                    <p className={`text-sm font-medium ${netLoans < 0 ? "text-red-500" : "text-emerald-500"}`}>
                      {formatAmount(Math.abs(netLoans), selectedGroup?.currency || "USD")}
                    </p>
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              {/* Activity */}
              <div
                className="rounded-xl bg-white p-5 shadow-sm dark:bg-card dark-card-bg animate-fadeIn"
                style={{ animationDelay: "100ms" }}
              >
                <h3 className="mb-4 text-lg font-medium">Activity</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                        <span className="text-blue-500">📊</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Total Transactions</p>
                        <p className="text-xs text-muted-foreground">Last 30 days</p>
                      </div>
                    </div>
                    <p className="text-lg font-semibold">{totalTransactions}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                        <span className="text-green-500">🔄</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Settlements</p>
                        <p className="text-xs text-muted-foreground">Last 30 days</p>
                      </div>
                    </div>
                    <p className="text-lg font-semibold">
                      {formatAmount(settlementAmount, selectedGroup?.currency || "USD")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Dialog para crear nuevo grupo */}
      <Dialog open={showAddGroupDialog} onOpenChange={setShowAddGroupDialog}>
        <DialogContent className="dialog-content">
          <DialogHeader>
            <DialogTitle>Crear nuevo grupo</DialogTitle>
            <DialogDescription>Crea un nuevo grupo para compartir gastos con amigos o familiares.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="groupName">Nombre del grupo</Label>
              <Input
                id="groupName"
                value={newGroup.name}
                onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                placeholder="ej. Viaje a la playa"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="groupDescription">Descripción (opcional)</Label>
              <Input
                id="groupDescription"
                value={newGroup.description}
                onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                placeholder="ej. Gastos del viaje a la playa en verano"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="groupEmoji">Emoji</Label>
                <Select value={newGroup.emoji} onValueChange={(value) => setNewGroup({ ...newGroup, emoji: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un emoji" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="🏠">🏠 Casa</SelectItem>
                    <SelectItem value="✈️">✈️ Viaje</SelectItem>
                    <SelectItem value="🍔">🍔 Comida</SelectItem>
                    <SelectItem value="🎮">🎮 Entretenimiento</SelectItem>
                    <SelectItem value="👨‍👩‍👧">👨‍👩‍👧 Familia</SelectItem>
                    <SelectItem value="💼">💼 Trabajo</SelectItem>
                    <SelectItem value="🎓">🎓 Educación</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="groupColor">Color</Label>
                <Select value={newGroup.color} onValueChange={(value) => setNewGroup({ ...newGroup, color: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un color" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emerald">Verde</SelectItem>
                    <SelectItem value="blue">Azul</SelectItem>
                    <SelectItem value="red">Rojo</SelectItem>
                    <SelectItem value="yellow">Amarillo</SelectItem>
                    <SelectItem value="purple">Morado</SelectItem>
                    <SelectItem value="pink">Rosa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="groupCurrency">Moneda</Label>
              <Select value={newGroup.currency} onValueChange={(value) => setNewGroup({ ...newGroup, currency: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una moneda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD - Dólar estadounidense</SelectItem>
                  <SelectItem value="PYG">PYG - Guaraní paraguayo</SelectItem>
                  <SelectItem value="ARS">ARS - Peso argentino</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="BRL">BRL - Real brasileño</SelectItem>
                  <SelectItem value="CLP">CLP - Peso chileno</SelectItem>
                  <SelectItem value="UYU">UYU - Peso uruguayo</SelectItem>
                  <SelectItem value="BOB">BOB - Boliviano</SelectItem>
                  <SelectItem value="PEN">PEN - Sol peruano</SelectItem>
                  <SelectItem value="COP">COP - Peso colombiano</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Miembros</Label>
              <div className="flex flex-wrap gap-2 border rounded-md p-3">
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200">You (Tú)</Badge>
                {newGroup.members
                  .filter((m) => m !== "You")
                  .map((member, index) => (
                    <Badge key={index} className="bg-blue-100 text-blue-700 hover:bg-blue-200 pr-1">
                      {member}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 ml-1"
                        onClick={() =>
                          setNewGroup({
                            ...newGroup,
                            members: newGroup.members.filter((m) => m !== member),
                          })
                        }
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-6">
                      <Plus className="h-3 w-3 mr-1" />
                      Añadir
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-60 p-0" align="start">
                    <div className="p-2">
                      <div className="space-y-1">
                        {people
                          .filter((p) => p.name !== "You" && !newGroup.members.includes(p.name))
                          .map((person) => (
                            <Button
                              key={person.id}
                              variant="ghost"
                              className="w-full justify-start"
                              onClick={() =>
                                setNewGroup({
                                  ...newGroup,
                                  members: [...newGroup.members, person.name],
                                })
                              }
                            >
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 mr-2">
                                <span className="text-xs">{person.initials}</span>
                              </div>
                              {person.name}
                            </Button>
                          ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddGroupDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddGroup}>Crear grupo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de invitación */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-md dialog-content">
          <DialogHeader>
            <DialogTitle>Invitar a {groups.find((g) => g.id === selectedGroupId)?.name || "grupo"}</DialogTitle>
            <DialogDescription>
              Invita a tus amigos o familiares a unirse a este grupo para compartir gastos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex items-center gap-3 rounded-lg border bg-amber-50/50 dark:bg-amber-900/20 p-3 text-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <span className="text-lg">⚠️</span>
              </div>
              <div>
                <p className="text-muted-foreground">
                  Solo podés invitar hasta <span className="font-medium">3 personas</span> en este plan.
                </p>
                <a
                  href="#"
                  className="text-emerald-600 dark:text-emerald-400 hover:underline text-sm mt-1 inline-block"
                >
                  Actualizar a premium →
                </a>
              </div>
            </div>

            <div className="grid gap-4">
              <Label htmlFor="inviteEmail">Email o nombre de usuario</Label>
              <Input
                id="inviteEmail"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="ejemplo@email.com"
                className="rounded-md border-muted-foreground/20"
              />
            </div>

            {inviteLink && (
              <div className="grid gap-2">
                <Label>Enlace de invitación</Label>
                <div className="flex items-center gap-2">
                  <Input value={inviteLink} readOnly className="rounded-md border-muted-foreground/20 bg-muted/30" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(inviteLink)
                      toast({
                        title: "Enlace copiado",
                        description: "El enlace ha sido copiado al portapapeles",
                        duration: 2000,
                      })
                    }}
                  >
                    Copiar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Este enlace expirará en 7 días.</p>
              </div>
            )}
          </div>
          <DialogFooter className="sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setShowInviteDialog(false)
                setInviteEmail("")
                setInviteLink("")
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleGenerateInviteLink} disabled={!inviteEmail}>
              Generar enlace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación para eliminar grupo */}
      <Dialog open={showDeleteGroupDialog} onOpenChange={setShowDeleteGroupDialog}>
        <DialogContent className="sm:max-w-md dialog-content">
          <DialogHeader>
            <DialogTitle className="text-red-500">¿Eliminar este grupo?</DialogTitle>
            <DialogDescription>
              Esta acción eliminará el grupo permanentemente. Los gastos compartidos dentro del grupo también se
              perderán. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-3 rounded-lg border bg-amber-50/50 dark:bg-amber-900/20 p-3 text-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <span className="text-lg">⚠️</span>
              </div>
              <p className="text-muted-foreground">
                Todos los miembros perderán acceso a las transacciones y balances de este grupo.
              </p>
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={() => setShowDeleteGroupDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                try {
                  // Verificar que no sea el grupo personal que no se puede eliminar
                  if (selectedGroupId === "personal") {
                    toast({
                      title: "Error",
                      description: "No puedes eliminar el grupo personal",
                      variant: "destructive",
                      duration: 3000,
                    })
                    setShowDeleteGroupDialog(false)
                    return
                  }

                  // Primero eliminar los miembros del grupo
                  const { error: memberDeleteError } = await supabase
                    .from("group_members")
                    .delete()
                    .eq("group_id", selectedGroupId)

                  if (memberDeleteError) throw memberDeleteError

                  // Luego eliminar las transacciones del grupo
                  const { error: transactionDeleteError } = await supabase
                    .from("transactions")
                    .delete()
                    .eq("group_id", selectedGroupId)

                  if (transactionDeleteError) throw transactionDeleteError

                  // Finalmente eliminar el grupo
                  const { error: groupDeleteError } = await supabase
                    .from("groups")
                    .delete()
                    .eq("id", selectedGroupId)
                    .eq("created_by", user.id)

                  if (groupDeleteError) throw groupDeleteError

                  // Actualizar el estado local eliminando el grupo
                  setGroups(groups.filter((group) => group.id !== selectedGroupId))

                  // Cambiar al grupo personal después de eliminar
                  setSelectedGroupId("personal")

                  setShowDeleteGroupDialog(false)
                  toast({
                    title: "Grupo eliminado",
                    description: "El grupo ha sido eliminado correctamente",
                    duration: 3000,
                  })
                } catch (error) {
                  console.error("Error al eliminar grupo:", error)
                  toast({
                    title: "Error al eliminar",
                    description:
                      error instanceof Error ? error.message : "No se pudo eliminar el grupo. Inténtalo de nuevo.",
                    variant: "destructive",
                    duration: 5000,
                  })
                }
              }}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación para eliminar transacción */}
      <Dialog open={showDeleteTransactionDialog} onOpenChange={setShowDeleteTransactionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-500">¿Eliminar esta transacción?</DialogTitle>
            <DialogDescription>
              Esta acción eliminará la transacción permanentemente. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-3 rounded-lg border bg-amber-50/50 dark:bg-amber-900/20 p-3 text-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <span className="text-lg">⚠️</span>
              </div>
              <div>
                <p className="font-medium mb-1">{transactionToDelete?.title}</p>
                <p className="text-muted-foreground">
                  Monto: {formatAmount(transactionToDelete?.amount || 0, selectedGroup?.currency || "USD")}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={() => setShowDeleteTransactionDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteTransaction}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

const people: { id: string; name: string; initials: string }[] = [
  {
    id: "1",
    name: "Alex",
    initials: "A",
  },
  {
    id: "2",
    name: "Taylor",
    initials: "T",
  },
]
