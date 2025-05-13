import { createClient as createServerClient } from "@/utils/supabase/server"
import { createClient as createBrowserClient } from "@/utils/supabase/client"

// Types based on our database schema
export interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Group {
  id: string
  name: string
  description: string | null
  emoji: string
  color: string
  currency: string
  monthly_budget: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface GroupMember {
  id: string
  group_id: string
  user_id: string
  role: "admin" | "member"
  created_at: string
}

export interface Invitation {
  id: string
  token: string
  group_id: string
  email?: string | null
  invited_by: string
  created_at: string
  expires_at: string
  used: boolean
  used_by?: string | null
  used_at?: string | null
}

export interface Transaction {
  id: string
  title: string
  amount: number
  type: 'expense' | 'loan' | 'settlement'
  paid_by: string
  paid_to?: string
  loaned_to?: string
  split_between?: string[]
  note?: string
  tag?: string
  group_id: string | null
  created_by: string
  created_at: string
  updated_at: string
  category?: string
  category_id?: string
}

export interface Budget {
  id: string
  user_id: string
  amount: number
  created_at: string
  updated_at: string
}

export interface Achievement {
  id: string
  title: string
  description: string
  emoji: string
  created_at: string
}

export interface FinancialTip {
  id: string
  text: string
  icon: string
  created_at: string
}

export interface UserAchievement {
  id: string
  user_id: string
  achievement_id: string
  created_at: string
}

// Server-side database functions
export const serverDb = {
  // Profile functions
  getProfile: async (userId: string) => {
    const supabase = createServerClient()
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single()

    if (error) throw error
    return data as Profile
  },

  // Groups functions
  getUserGroups: async (userId: string) => {
    const supabase = createServerClient()
    const { data: groupMembers, error: membersError } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", userId)

    if (membersError) throw membersError

    if (groupMembers.length === 0) return []

    const groupIds = groupMembers.map((member) => member.group_id)

    const { data: groups, error: groupsError } = await supabase.from("groups").select("*").in("id", groupIds)

    if (groupsError) throw groupsError
    return groups as Group[]
  },

  // Transactions functions
  getGroupTransactions: async (groupId: string) => {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })

    if (error) throw error
    return data as Transaction[]
  },

  // Budget functions
  getUserBudget: async (userId: string) => {
    const supabase = createServerClient()
    const { data, error } = await supabase.from("budgets").select("*").eq("user_id", userId).single()

    if (error && error.code !== "PGRST116") throw error
    return data as Budget | null
  },

  // Achievements functions
  getUserAchievements: async (userId: string) => {
    const supabase = createServerClient()
    const { data: userAchievements, error: userAchievementsError } = await supabase
      .from("user_achievements")
      .select("achievement_id")
      .eq("user_id", userId)

    if (userAchievementsError) throw userAchievementsError

    if (userAchievements.length === 0) return []

    const achievementIds = userAchievements.map((ua) => ua.achievement_id)

    const { data: achievements, error: achievementsError } = await supabase
      .from("achievements")
      .select("*")
      .in("id", achievementIds)

    if (achievementsError) throw achievementsError
    return achievements as Achievement[]
  },

  // Financial tips functions
  getFinancialTips: async () => {
    const supabase = createServerClient()
    const { data, error } = await supabase.from("financial_tips").select("*")

    if (error) throw error
    return data as FinancialTip[]
  },

  // Invitations functions
  getInvitationByToken: async (token: string) => {
    const supabase = createServerClient()
    const { data, error } = await supabase.from("invitations").select("*").eq("token", token).single()

    if (error) throw error
    return data as Invitation
  },
}

// Client-side database functions
export const clientDb = {
  // Profile functions
  updateProfile: async (userId: string, profile: Partial<Profile>) => {
    const supabase = createBrowserClient()
    const { data, error } = await supabase.from("profiles").update(profile).eq("id", userId).select().single()

    if (error) throw error
    return data as Profile
  },

  // Groups functions
  createGroup: async (group: Omit<Group, "id" | "created_at" | "updated_at">) => {
    const supabase = createBrowserClient()
    const { data, error } = await supabase.from("groups").insert(group).select().single()

    if (error) throw error
    return data as Group
  },

  addGroupMember: async (groupId: string, userId: string, role: "admin" | "member" = "member") => {
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from("group_members")
      .insert({
        group_id: groupId,
        user_id: userId,
        role,
      })
      .select()
      .single()

    if (error) throw error
    return data as GroupMember
  },

  // Transactions functions
  createTransaction: async (transaction: Omit<Transaction, "id" | "created_at" | "updated_at">) => {
    const supabase = createBrowserClient()
    const { data, error } = await supabase.from("transactions").insert(transaction).select().single()

    if (error) throw error
    return data as Transaction
  },

  // Budget functions
  updateBudget: async (userId: string, amount: number) => {
    const supabase = createBrowserClient()

    // Check if budget exists
    const { data: existingBudget, error: checkError } = await supabase
      .from("budgets")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle()

    if (checkError) throw checkError

    if (existingBudget) {
      // Update existing budget
      const { data, error } = await supabase
        .from("budgets")
        .update({ amount, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .select()
        .single()

      if (error) throw error
      return data as Budget
    } else {
      // Create new budget
      const { data, error } = await supabase
        .from("budgets")
        .insert({
          user_id: userId,
          amount,
        })
        .select()
        .single()

      if (error) throw error
      return data as Budget
    }
  },

  // Achievements functions
  unlockAchievement: async (userId: string, achievementId: string) => {
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from("user_achievements")
      .insert({
        user_id: userId,
        achievement_id: achievementId,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Invitations functions
  createInvitation: async (invitation: Omit<Invitation, "id" | "created_at" | "used" | "used_by" | "used_at">) => {
    const supabase = createBrowserClient()
    const { data, error } = await supabase.from("invitations").insert(invitation).select().single()

    if (error) throw error
    return data as Invitation
  },

  getInvitationByToken: async (token: string) => {
    const supabase = createBrowserClient()
    const { data, error } = await supabase.from("invitations").select("*").eq("token", token).single()

    if (error) throw error
    return data as Invitation
  },

  acceptInvitation: async (token: string, userId: string) => {
    const supabase = createBrowserClient()

    // 1. Get the invitation
    const { data: invitation, error: invitationError } = await supabase
      .from("invitations")
      .select("*")
      .eq("token", token)
      .single()

    if (invitationError) throw invitationError

    // 2. Add the user to the group
    const { data: member, error: memberError } = await supabase
      .from("group_members")
      .insert({
        group_id: invitation.group_id,
        user_id: userId,
        role: "member",
      })
      .select()
      .single()

    if (memberError) throw memberError

    // 3. Mark the invitation as used
    const { error: updateError } = await supabase
      .from("invitations")
      .update({
        used: true,
        used_by: userId,
        used_at: new Date().toISOString(),
      })
      .eq("token", token)

    if (updateError) throw updateError

    return member
  },
}
