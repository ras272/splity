require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const path = require("path")
const { createClient } = require("@supabase/supabase-js")

// Configurar el cliente de Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // Nota: Necesitas un service_role key para ejecutar SQL directo
)

async function runMigration() {
  try {
    console.log("Ejecutando migración para la tabla de invitaciones...")

    // Leer el archivo SQL
    const sqlFilePath = path.join(__dirname, "migrations", "create_invitations_table.sql")
    const sql = fs.readFileSync(sqlFilePath, "utf8")

    // Ejecutar el SQL directamente
    const { error } = await supabase.from("_migrations").insert({
      name: "create_invitations_table",
      sql: sql,
      executed_at: new Date().toISOString(),
    })

    if (error) {
      // Si la tabla _migrations no existe, ejecutar directamente el SQL
      console.log("Ejecutando SQL directamente...")
      const { error: sqlError } = await supabase.rpc("exec_sql", { sql })

      if (sqlError) {
        throw sqlError
      }
    }

    console.log("Migración completada con éxito.")
  } catch (error) {
    console.error("Error al ejecutar la migración:", error)
    process.exit(1)
  }
}

runMigration()
