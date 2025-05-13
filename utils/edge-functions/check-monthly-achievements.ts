import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req: Request) => {
  try {
    // Verificar que la solicitud sea un cron job
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Crear cliente de Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    // Obtener todos los usuarios
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id')

    if (usersError) throw usersError

    // Para cada usuario, verificar sus logros mensuales
    for (const user of users) {
      // Obtener los grupos del usuario
      const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select('monthly_budget')
        .eq('created_by', user.id)

      if (groupsError) {
        console.error(`Error getting groups for user ${user.id}:`, groupsError)
        continue
      }

      // Obtener las transacciones del mes
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('amount')
        .eq('type', 'expense')
        .eq('created_by', user.id)
        .gte('created_at', startOfMonth.toISOString())
        .lte('created_at', endOfMonth.toISOString())

      if (transactionsError) {
        console.error(`Error getting transactions for user ${user.id}:`, transactionsError)
        continue
      }

      const totalBudget = groups.reduce((sum: number, group: any) => sum + (group.monthly_budget || 0), 0)
      const totalSpent = transactions.reduce((sum: number, tx: any) => sum + tx.amount, 0)

      if (totalSpent <= totalBudget) {
        // Obtener logros relacionados con el presupuesto
        const { data: achievements, error: achievementsError } = await supabase
          .from('achievements')
          .select('*')
          .eq('trigger_event', 'month_end')

        if (achievementsError) {
          console.error(`Error getting achievements for user ${user.id}:`, achievementsError)
          continue
        }

        // Verificar cada logro
        for (const achievement of achievements) {
          // Verificar si el usuario ya tiene este logro
          const { data: existingAchievement, error: existingError } = await supabase
            .from('user_achievements')
            .select('id')
            .eq('user_id', user.id)
            .eq('achievement_id', achievement.id)
            .single()

          if (existingError && existingError.code !== 'PGRST116') {
            console.error(`Error checking existing achievement for user ${user.id}:`, existingError)
            continue
          }

          if (!existingAchievement) {
            // Desbloquear el logro
            const { error: unlockError } = await supabase
              .from('user_achievements')
              .insert({
                user_id: user.id,
                achievement_id: achievement.id
              })

            if (unlockError) {
              console.error(`Error unlocking achievement for user ${user.id}:`, unlockError)
            }
          }
        }
      }
    }

    return new Response('Monthly achievements checked successfully', { status: 200 })
  } catch (error) {
    console.error('Error in monthly achievements check:', error)
    return new Response('Internal server error', { status: 500 })
  }
}) 