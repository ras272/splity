import { createClient } from '@/utils/supabase/client'
import { toast } from '@/components/ui/use-toast'
import { Group, Transaction } from './database'

export interface Achievement {
  id: string
  title: string
  description: string
  emoji: string
  type: 'global' | 'grupo' | 'personal'
  trigger_event: string
  condition: {
    type: string
    target?: number
    metric?: string
    condition?: string
    months?: number
  }
}

export interface UserAchievement {
  id: string
  user_id: string
  achievement_id: string
  created_at: string
}

// Función para verificar si se cumple una condición de logro
const checkAchievementCondition = async (achievement: Achievement, userId: string): Promise<boolean> => {
  const supabase = createClient()
  const { type, target, metric, condition, months } = achievement.condition

  switch (type) {
    case 'count':
      if (!target || !metric) return false

      let query = supabase
        .from(metric === 'expenses' ? 'transactions' : metric === 'groups' ? 'group_members' : 'invitations')
        .select('id', { count: 'exact' })
        .eq('created_by', userId)

      if (metric === 'expenses') {
        query = query.eq('type', 'expense')
      }

      const { count, error } = await query

      if (error) {
        console.error('Error checking achievement condition:', error)
        return false
      }

      return (count || 0) >= target

    case 'budget':
      if (condition !== 'under_limit') return false

      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

      // Obtener el presupuesto del grupo
      const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select('monthly_budget')
        .eq('created_by', userId)

      if (groupsError) {
        console.error('Error checking budget:', groupsError)
        return false
      }

      // Obtener los gastos del mes
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('amount')
        .eq('type', 'expense')
        .eq('created_by', userId)
        .gte('created_at', startOfMonth.toISOString())
        .lte('created_at', endOfMonth.toISOString())

      if (transactionsError) {
        console.error('Error checking transactions:', transactionsError)
        return false
      }

      const totalBudget = groups.reduce((sum: number, group: Group) => sum + (group.monthly_budget || 0), 0)
      const totalSpent = transactions.reduce((sum: number, tx: Transaction) => sum + tx.amount, 0)

      return totalSpent <= totalBudget

    default:
      return false
  }
}

// Función para verificar y desbloquear logros
export const checkAchievements = async (userId: string, triggerEvent: string) => {
  const supabase = createClient()

  try {
    // Obtener todos los logros que coincidan con el evento disparador
    const { data: achievements, error: achievementsError } = await supabase
      .from('achievements')
      .select('*')
      .eq('trigger_event', triggerEvent)

    if (achievementsError) throw achievementsError

    // Obtener los logros ya desbloqueados por el usuario
    const { data: userAchievements, error: userAchievementsError } = await supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', userId)

    if (userAchievementsError) throw userAchievementsError

    const unlockedAchievementIds = userAchievements.map((ua: UserAchievement) => ua.achievement_id)

    // Verificar cada logro no desbloqueado
    for (const achievement of achievements) {
      if (unlockedAchievementIds.includes(achievement.id)) continue

      const conditionMet = await checkAchievementCondition(achievement, userId)

      if (conditionMet) {
        // Desbloquear el logro
        const { error: unlockError } = await supabase
          .from('user_achievements')
          .insert({
            user_id: userId,
            achievement_id: achievement.id
          })

        if (unlockError) {
          console.error('Error unlocking achievement:', unlockError)
          continue
        }

        // Mostrar notificación
        toast({
          title: "🎉 ¡Logro desbloqueado!",
          description: `${achievement.emoji} ${achievement.title} - ${achievement.description}`,
          duration: 5000,
        })
      }
    }
  } catch (error) {
    console.error('Error checking achievements:', error)
  }
} 