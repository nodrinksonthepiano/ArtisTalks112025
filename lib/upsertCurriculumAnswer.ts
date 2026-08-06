import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Select-then-update-or-insert for a null-project curriculum answer.
 * Partial unique index is a race backstop — not the update mechanism.
 */
export async function upsertCurriculumAnswer(
  supabase: SupabaseClient,
  userId: string,
  question_key: string,
  answer_data: Record<string, unknown>
): Promise<{ error: Error | null }> {
  const { data: existing, error: checkError } = await supabase
    .from('curriculum_answers')
    .select('id')
    .eq('user_id', userId)
    .eq('question_key', question_key)
    .is('project_id', null)
    .maybeSingle()

  if (checkError) {
    return { error: new Error(checkError.message) }
  }

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from('curriculum_answers')
      .update({ answer_data })
      .eq('id', existing.id)

    if (updateError) {
      return { error: new Error(updateError.message) }
    }
    return { error: null }
  }

  const { error: insertError } = await supabase.from('curriculum_answers').insert({
    user_id: userId,
    question_key,
    answer_data,
    project_id: null,
  })

  if (insertError) {
    return { error: new Error(insertError.message) }
  }
  return { error: null }
}
