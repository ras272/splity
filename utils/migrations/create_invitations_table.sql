-- Crear tabla de invitaciones si no existe
CREATE TABLE IF NOT EXISTS invitations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  email TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE
);

-- Crear indice para busquedas rapidas por token
CREATE INDEX IF NOT EXISTS invitations_token_idx ON invitations(token);

-- Crear indice para las invitaciones por grupo
CREATE INDEX IF NOT EXISTS invitations_group_id_idx ON invitations(group_id);

-- Crear politica RLS para que solo los administradores del grupo puedan crear invitaciones
CREATE POLICY "Allow users to create invitations for groups they administer" ON invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = invitations.group_id
        AND group_members.user_id = auth.uid()
        AND group_members.role = 'admin'
    )
  );

-- Politica para permitir ver las invitaciones que creaste
CREATE POLICY "Allow users to view invitations they created" ON invitations
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- Politica para permitir ver cualquier invitacion a traves del token
CREATE POLICY "Allow users to view invitations by token" ON invitations
  FOR SELECT
  TO authenticated
  USING (TRUE);

-- Politica para permitir actualizar invitaciones (marcarlas como usadas)
CREATE POLICY "Allow users to mark invitations as used" ON invitations
  FOR UPDATE
  TO authenticated
  USING (TRUE)
  WITH CHECK (
    (used = TRUE AND used_by = auth.uid()) -- Solo actualizar para marcar como usada
  );
