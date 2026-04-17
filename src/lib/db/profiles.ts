import { getDb } from './client'
import type { Profile, Role } from '@/types'

export async function listProfiles(): Promise<Profile[]> {
  const db = await getDb()
  return db.select<Profile[]>('SELECT * FROM profiles ORDER BY name ASC')
}

export async function getProfile(id: number): Promise<Profile | null> {
  const db = await getDb()
  const rows = await db.select<Profile[]>('SELECT * FROM profiles WHERE id = $1', [id])
  return rows[0] ?? null
}

export interface CreateProfileInput {
  name: string
  role?: Role
  avatar?: string | null
  color?: string
  pin?: string | null
}

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function createProfile(input: CreateProfileInput): Promise<number> {
  const db = await getDb()
  const pin_hash = input.pin ? await hashPin(input.pin) : null
  const res = await db.execute(
    'INSERT INTO profiles (name, role, avatar, color, pin_hash) VALUES ($1, $2, $3, $4, $5)',
    [input.name, input.role ?? 'fonoaudiologo', input.avatar ?? null, input.color ?? '#6B1F2E', pin_hash]
  )
  return res.lastInsertId ?? 0
}

export async function updateProfile(id: number, input: Partial<CreateProfileInput>): Promise<void> {
  const db = await getDb()
  const updates: string[] = []
  const params: unknown[] = []
  let i = 1
  if (input.name !== undefined) { updates.push(`name = $${i++}`); params.push(input.name) }
  if (input.role !== undefined) { updates.push(`role = $${i++}`); params.push(input.role) }
  if (input.avatar !== undefined) { updates.push(`avatar = $${i++}`); params.push(input.avatar) }
  if (input.color !== undefined) { updates.push(`color = $${i++}`); params.push(input.color) }
  if (input.pin !== undefined) {
    const hash = input.pin ? await hashPin(input.pin) : null
    updates.push(`pin_hash = $${i++}`); params.push(hash)
  }
  if (!updates.length) return
  updates.push(`updated_at = datetime('now')`)
  params.push(id)
  await db.execute(`UPDATE profiles SET ${updates.join(', ')} WHERE id = $${i}`, params)
}

export async function deleteProfile(id: number): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM profiles WHERE id = $1', [id])
}

export async function verifyPin(id: number, pin: string): Promise<boolean> {
  const profile = await getProfile(id)
  if (!profile?.pin_hash) return true
  const hash = await hashPin(pin)
  return hash === profile.pin_hash
}
