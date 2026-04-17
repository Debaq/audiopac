import { getDb } from './client'
import type { TestTemplate, TestTemplateParsed, TestConfig, TestType } from '@/types'

function parseTemplate(t: TestTemplate): TestTemplateParsed {
  return { ...t, config: JSON.parse(t.config_json) as TestConfig }
}

export async function listTemplates(onlyActive = true): Promise<TestTemplateParsed[]> {
  const db = await getDb()
  const sql = onlyActive
    ? 'SELECT * FROM test_templates WHERE is_active = 1 ORDER BY is_standard DESC, name'
    : 'SELECT * FROM test_templates ORDER BY is_standard DESC, name'
  const rows = await db.select<TestTemplate[]>(sql)
  return rows.map(parseTemplate)
}

export async function getTemplate(id: number): Promise<TestTemplateParsed | null> {
  const db = await getDb()
  const rows = await db.select<TestTemplate[]>('SELECT * FROM test_templates WHERE id = $1', [id])
  return rows[0] ? parseTemplate(rows[0]) : null
}

export interface CreateTemplateInput {
  code: string
  name: string
  test_type: TestType
  description?: string
  config: TestConfig
  created_by?: number | null
}

export async function createTemplate(input: CreateTemplateInput): Promise<number> {
  const db = await getDb()
  const res = await db.execute(
    `INSERT INTO test_templates (code, name, test_type, description, config_json, is_standard, created_by)
     VALUES ($1,$2,$3,$4,$5,0,$6)`,
    [input.code, input.name, input.test_type, input.description ?? null, JSON.stringify(input.config), input.created_by ?? null]
  )
  return res.lastInsertId ?? 0
}

export async function updateTemplate(id: number, input: Partial<CreateTemplateInput>): Promise<void> {
  const db = await getDb()
  const updates: string[] = []
  const params: unknown[] = []
  let i = 1
  if (input.code !== undefined) { updates.push(`code = $${i++}`); params.push(input.code) }
  if (input.name !== undefined) { updates.push(`name = $${i++}`); params.push(input.name) }
  if (input.test_type !== undefined) { updates.push(`test_type = $${i++}`); params.push(input.test_type) }
  if (input.description !== undefined) { updates.push(`description = $${i++}`); params.push(input.description) }
  if (input.config !== undefined) { updates.push(`config_json = $${i++}`); params.push(JSON.stringify(input.config)) }
  if (!updates.length) return
  updates.push(`updated_at = datetime('now')`)
  params.push(id)
  await db.execute(`UPDATE test_templates SET ${updates.join(', ')} WHERE id = $${i}`, params)
}

export async function deactivateTemplate(id: number): Promise<void> {
  const db = await getDb()
  await db.execute('UPDATE test_templates SET is_active = 0 WHERE id = $1 AND is_standard = 0', [id])
}

export async function deleteTemplate(id: number): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM test_templates WHERE id = $1 AND is_standard = 0', [id])
}
