/*
  # Create boards table

  1. New Tables
    - `boards`
      - `id` (uuid, primary key)
      - `name` (text)
      - `created_by` (uuid, foreign key to users.id)
      - `created_at` (timestamp)
      - `history` (jsonb array to store drawing history)
  2. Security
    - Enable RLS on `boards` table
    - Add policy for authenticated users to read and update their own boards
*/

CREATE TABLE IF NOT EXISTS boards (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  history jsonb DEFAULT '[]'::jsonb
);

ALTER TABLE boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own boards"
  ON boards
  FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Users can update own boards"
  ON boards
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own boards"
  ON boards
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);