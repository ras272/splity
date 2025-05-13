"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { BarChart3, Calendar, CreditCard, DollarSign } from "lucide-react"

// Definir interfaces para los tipos de datos
interface MonthlyStats {
  totalExpenses: number
  transactionCount: number
  averageExpense: number
  expensesByCategory: {
    category: string
    amount: number
    percentage: number
  }[]
  hasData: boolean
}

interface MonthlyStatsProps {
  transactions: any[]
  groupId: string | null
  isLoading: boolean
}

export default function MonthlyStats({ transactions, groupId, isLoading }: MonthlyStatsProps) {
  const [stats, setStats] = useState<MonthlyStats>({
    totalExpenses: 0,
    transactionCount: 0,
    averageExpense: 0,
    expensesByCategory: [],
    hasData: false,
  })
  const [isCalculating, setIsCalculating] = useState(true)

  useEffect(() => {
    if (isLoading) {
      setIsCalculating(true)
      return
    }

    calculateMonthlyStats()
  }, [transactions, groupId, isLoading])

  const calculateMonthlyStats = () => {
    setIsCalculating(true)

    // Obtener el mes actual
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    // Filtrar transacciones del mes actual, tipo "expense" y del grupo seleccionado
    const filteredTransactions = transactions.filter((tx) => {
      const txDate = new Date(tx.created_at)
      return txDate >= startOfMonth && txDate <= endOfMonth && tx.type === "expense" && tx.group_id === groupId
    })

    // Si no hay transacciones, establecer estadísticas vacías
    if (filteredTransactions.length === 0) {
      setStats({
        totalExpenses: 0,
        transactionCount: 0,
        averageExpense: 0,
        expensesByCategory: [],
        hasData: false,
      })
      setIsCalculating(false)
      return
    }

    // Calcular estadísticas
    const totalExpenses = filteredTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0)

    const transactionCount = filteredTransactions.length

    const averageExpense = totalExpenses / transactionCount

    // Agrupar por categoría (tag o note)
    const categoriesMap = new Map()

    filteredTransactions.forEach((tx) => {
      const category = tx.tag || tx.note || "Sin categoría"
      const amount = Number(tx.amount)

      if (categoriesMap.has(category)) {
        categoriesMap.set(category, categoriesMap.get(category) + amount)
      } else {
        categoriesMap.set(category, amount)
      }
    })

    // Convertir a array y calcular porcentajes
    const expensesByCategory = Array.from(categoriesMap.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: (Number(amount) / totalExpenses) * 100,
      }))
      .sort((a, b) => b.amount - a.amount)

    // Actualizar estado
    setStats({
      totalExpenses,
      transactionCount,
      averageExpense,
      expensesByCategory,
      hasData: true,
    })

    setIsCalculating(false)
  }

  // Formatear número como moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(amount)
  }

  return (
    <Card className="col-span-3">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Estadísticas Mensuales</CardTitle>
        <Calendar className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isCalculating ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : !stats.hasData ? (
          <div className="py-6 text-center text-muted-foreground">Aún no hay estadísticas este mes.</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col justify-between p-3 rounded-lg border border-border/50 bg-card h-full">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Total Gastos</span>
                </div>
                <span className="text-lg font-bold">{formatCurrency(stats.totalExpenses)}</span>
              </div>

              <div className="flex flex-col justify-between p-3 rounded-lg border border-border/50 bg-card h-full">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Transacciones</span>
                </div>
                <span className="text-lg font-bold">{stats.transactionCount}</span>
              </div>

              <div className="flex flex-col justify-between p-3 rounded-lg border border-border/50 bg-card h-full">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Promedio</span>
                </div>
                <span className="text-lg font-bold">{formatCurrency(stats.averageExpense)}</span>
              </div>
            </div>

            {stats.expensesByCategory.length > 0 && (
              <div className="space-y-3 mt-2">
                <h4 className="text-sm font-medium text-muted-foreground">Distribución de Gastos</h4>
                {stats.expensesByCategory.map((category, index) => (
                  <div key={index} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="truncate max-w-[60%]" title={category.category}>
                        {category.category}
                      </span>
                      <span className="whitespace-nowrap text-right">
                        {formatCurrency(category.amount)} ({Math.round(category.percentage)}%)
                      </span>
                    </div>
                    <Progress value={category.percentage} className="h-1.5" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
