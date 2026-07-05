export type StepId = 
  // Curriculum V2 spine
  | 'INIT'
  | 'COLORS_PANEL'
  | 'GIFT_PRESENCE'
  | 'KNOWN_FOR_LEGACY'
  | 'KNOWN_FOR_EXPRESSION'
  | 'TARGET_REACH'
  | 'GENRE_ASSOCIATIONS'
  | 'BUSINESS_OFFERING'
  | 'CURRENT_FOCUS_PILLAR'
  | 'FAN_CONNECTION'
  | 'FAN_STRUGGLES'
  | 'FAN_DREAMS'
  | 'AUDIENCE_AVATAR'
  | 'COLLABORATORS'
  | 'OPEN_FOR_SUPPORT'
  | 'PLAYLIST_CONTEXT'
  | 'SPONSOR_BRAND_ALLIES'
  | 'INFLUENCERS_COMMUNITIES'
  | 'WARDROBE_IMAGE'
  | 'SIGNATURE_WORLD'
  | 'GRATITUDE_MOMENTUM'
  | 'COMPLETE'
  // Compatibility stubs for older saved cards / events
  | 'MISSION_GIFT'
  | 'PRE_COMPLETE'
  | 'PROJECT_NAME'
  | 'PROJECT_DESCRIPTION'
  | 'ASSET_UPLOAD_PANEL'
  | 'PROD_COMPLETE'
  | 'PROMO_STRATEGY'
  | 'TARGET_AUDIENCE'
  | 'LAUNCH_DATE'
  | 'POST_COMPLETE'
  | 'GRATITUDE'
  | 'LEGACY_VISION'
  | 'FEEDBACK_LOOP';

export interface CurriculumStep {
  id: StepId;
  question: string;
  nextStep: StepId;
  key: string; // The key used in the database (curriculum_answers table)
  placeholder?: string;
  triggersPanel?: 'colors' | 'asset'; // Panel to trigger after this step
  phase?: 'pre' | 'prod' | 'post' | 'legacy';
}

// The Deterministic "Script" for all phases
export const CURRICULUM: Record<StepId, CurriculumStep> = {
  // Curriculum V2 spine
  INIT: {
    id: 'INIT',
    question: "Welcome, My Champion. First things first: what is your artist name?",
    nextStep: 'COLORS_PANEL',
    key: 'artist_name',
    placeholder: "e.g. JAI",
    phase: 'pre'
  },
  COLORS_PANEL: {
    id: 'COLORS_PANEL',
    question: "Great! Now choose your brand colors, logo, and font.",
    nextStep: 'GIFT_PRESENCE',
    key: 'colors_set',
    triggersPanel: 'colors',
    phase: 'pre'
  },
  GIFT_PRESENCE: {
    id: 'GIFT_PRESENCE',
    question: "Acknowledge yourself. What makes your presence a gift to the world?",
    nextStep: 'KNOWN_FOR_LEGACY',
    key: 'gift_to_world',
    placeholder: "My presence is a gift because...",
    phase: 'pre'
  },
  KNOWN_FOR_LEGACY: {
    id: 'KNOWN_FOR_LEGACY',
    question: "In 5, 50, or 100 years, people are celebrating your life and your contributions. What are they saying you were really known for?",
    nextStep: 'KNOWN_FOR_EXPRESSION',
    key: 'known_for_legacy',
    placeholder: "They say I was known for...",
    phase: 'legacy'
  },
  KNOWN_FOR_EXPRESSION: {
    id: 'KNOWN_FOR_EXPRESSION',
    question: "What do you want your words, actions, music, and art to be known for?",
    nextStep: 'TARGET_REACH',
    key: 'known_for_expression',
    placeholder: "My words, actions, music, and art are known for...",
    phase: 'pre'
  },
  TARGET_REACH: {
    id: 'TARGET_REACH',
    question: "Is your target reach local, regional, national, international, or something more specific?",
    nextStep: 'GENRE_ASSOCIATIONS',
    key: 'target_reach',
    placeholder: "Local, regional, national, international...",
    phase: 'post'
  },
  GENRE_ASSOCIATIONS: {
    id: 'GENRE_ASSOCIATIONS',
    question: "What are the top three genres, scenes, or worlds people are likely to associate you with?",
    nextStep: 'BUSINESS_OFFERING',
    key: 'genre_associations',
    placeholder: "e.g. R&B, Broadway, sacred pop...",
    phase: 'pre'
  },
  BUSINESS_OFFERING: {
    id: 'BUSINESS_OFFERING',
    question: "What kind of creative business are you building, and what are your main products or services right now?",
    nextStep: 'CURRENT_FOCUS_PILLAR',
    key: 'business_type_products_services',
    placeholder: "Songs, live shows, writing, production, merch, visuals, licensing, events...",
    phase: 'pre'
  },
  CURRENT_FOCUS_PILLAR: {
    id: 'CURRENT_FOCUS_PILLAR',
    question: "What are you creating now: something brand new, something you are finishing, or something finished that needs promotion and momentum?",
    nextStep: 'FAN_CONNECTION',
    key: 'current_focus_pillar',
    placeholder: "Creating new / finishing / promoting / not sure",
    phase: 'pre'
  },
  FAN_CONNECTION: {
    id: 'FAN_CONNECTION',
    question: "What do your fans connect to most in you, your music, your message, or your creative business?",
    nextStep: 'FAN_STRUGGLES',
    key: 'fan_connection',
    placeholder: "My fans connect to...",
    phase: 'post'
  },
  FAN_STRUGGLES: {
    id: 'FAN_STRUGGLES',
    question: "What do your fans struggle with in their own lives?",
    nextStep: 'FAN_DREAMS',
    key: 'fan_struggles',
    placeholder: "My fans struggle with...",
    phase: 'prod'
  },
  FAN_DREAMS: {
    id: 'FAN_DREAMS',
    question: "What do your fans dream of?",
    nextStep: 'AUDIENCE_AVATAR',
    key: 'fan_dreams',
    placeholder: "My fans dream of...",
    phase: 'prod'
  },
  AUDIENCE_AVATAR: {
    id: 'AUDIENCE_AVATAR',
    question: "Who is your ideal listener or supporter? Think age, location, interests, habits, hangout spots, values, and what they care about.",
    nextStep: 'COLLABORATORS',
    key: 'audience_avatar',
    placeholder: "My ideal listener is...",
    phase: 'post'
  },
  COLLABORATORS: {
    id: 'COLLABORATORS',
    question: "Who are some artists, producers, writers, creators, or leaders you would love to collaborate with?",
    nextStep: 'OPEN_FOR_SUPPORT',
    key: 'collaborators_wishlist',
    placeholder: "I would love to collaborate with...",
    phase: 'prod'
  },
  OPEN_FOR_SUPPORT: {
    id: 'OPEN_FOR_SUPPORT',
    question: "Who are some artists you could open for, support, tour with, or share a stage with?",
    nextStep: 'PLAYLIST_CONTEXT',
    key: 'open_for_support_targets',
    placeholder: "I could open for, support, tour with, or share a stage with...",
    phase: 'post'
  },
  PLAYLIST_CONTEXT: {
    id: 'PLAYLIST_CONTEXT',
    question: "If your music was in a playlist, who would you be played before and after?",
    nextStep: 'SPONSOR_BRAND_ALLIES',
    key: 'playlist_context',
    placeholder: "I would be played before/after...",
    phase: 'post'
  },
  SPONSOR_BRAND_ALLIES: {
    id: 'SPONSOR_BRAND_ALLIES',
    question: "What sponsors, brands, local businesses, or aligned partners would make sense in your world?",
    nextStep: 'INFLUENCERS_COMMUNITIES',
    key: 'sponsor_brand_allies',
    placeholder: "Aligned partners could include...",
    phase: 'post'
  },
  INFLUENCERS_COMMUNITIES: {
    id: 'INFLUENCERS_COMMUNITIES',
    question: "Who are the influencers, communities, groups, venues, scenes, or tribes that already gather people similar to your audience?",
    nextStep: 'WARDROBE_IMAGE',
    key: 'influencers_communities',
    placeholder: "My people are already gathering around...",
    phase: 'post'
  },
  WARDROBE_IMAGE: {
    id: 'WARDROBE_IMAGE',
    question: "What does your on-stage wardrobe or public image look like when you are fully showing up?",
    nextStep: 'SIGNATURE_WORLD',
    key: 'wardrobe_public_image',
    placeholder: "When I am fully showing up, I look like...",
    phase: 'pre'
  },
  SIGNATURE_WORLD: {
    id: 'SIGNATURE_WORLD',
    question: "What lyric, phrase, symbol, image, story, joke, or piece of stage banter could become part of your signature world?",
    nextStep: 'GRATITUDE_MOMENTUM',
    key: 'signature_world_elements',
    placeholder: "A signature piece of my world is...",
    phase: 'post'
  },
  GRATITUDE_MOMENTUM: {
    id: 'GRATITUDE_MOMENTUM',
    question: "What are you grateful for right now, and what blessing might already be on the way that you cannot fully see yet?",
    nextStep: 'COMPLETE',
    key: 'gratitude_momentum',
    placeholder: "I am grateful for...",
    phase: 'legacy'
  },
  COMPLETE: {
    id: 'COMPLETE',
    question: "Beautiful. We have the first real map of your release world. The next move is to test this against the work.",
    nextStep: 'COMPLETE',
    key: 'completed',
    placeholder: "",
    phase: 'legacy'
  },

  // Compatibility stubs for older saved cards / events. The main V2 flow does not route through these.
  MISSION_GIFT: {
    id: 'MISSION_GIFT',
    question: "Acknowledge yourself. What makes your presence a gift to the world?",
    nextStep: 'KNOWN_FOR_LEGACY',
    key: 'gift_to_world',
    placeholder: "My presence is a gift because...",
    phase: 'pre'
  },
  PRE_COMPLETE: {
    id: 'PRE_COMPLETE',
    question: "Outstanding! Your foundation is set. Ready to create?",
    nextStep: 'FAN_STRUGGLES',
    key: 'pre_complete',
    phase: 'pre'
  },
  PROJECT_NAME: {
    id: 'PROJECT_NAME',
    question: "What are you working on right now? Give me the name of your current project.",
    nextStep: 'PROJECT_DESCRIPTION',
    key: 'project_name',
    placeholder: "e.g. My Debut Album, New Single...",
    phase: 'prod'
  },
  PROJECT_DESCRIPTION: {
    id: 'PROJECT_DESCRIPTION',
    question: "Tell me more about this project. What's it about?",
    nextStep: 'ASSET_UPLOAD_PANEL',
    key: 'project_description',
    placeholder: "Describe your project...",
    phase: 'prod'
  },
  ASSET_UPLOAD_PANEL: {
    id: 'ASSET_UPLOAD_PANEL',
    question: "Want to upload a cover image or demo for this project?",
    nextStep: 'PROD_COMPLETE',
    key: 'asset_uploaded',
    triggersPanel: 'asset',
    phase: 'prod'
  },
  PROD_COMPLETE: {
    id: 'PROD_COMPLETE',
    question: "Beautiful! Your project is taking shape.",
    nextStep: 'TARGET_REACH',
    key: 'prod_complete',
    phase: 'prod'
  },
  PROMO_STRATEGY: {
    id: 'PROMO_STRATEGY',
    question: "How will you share this with the world? What's your promotion plan?",
    nextStep: 'TARGET_AUDIENCE',
    key: 'promo_strategy',
    placeholder: "Social media, live shows, streaming...",
    phase: 'post'
  },
  TARGET_AUDIENCE: {
    id: 'TARGET_AUDIENCE',
    question: "Who is your target audience?",
    nextStep: 'LAUNCH_DATE',
    key: 'target_audience',
    placeholder: "Who needs to hear this?",
    phase: 'post'
  },
  LAUNCH_DATE: {
    id: 'LAUNCH_DATE',
    question: "When do you plan to launch?",
    nextStep: 'POST_COMPLETE',
    key: 'launch_date',
    placeholder: "e.g. Q2 2025, Spring...",
    phase: 'post'
  },
  POST_COMPLETE: {
    id: 'POST_COMPLETE',
    question: "Perfect! Your launch plan is ready.",
    nextStep: 'KNOWN_FOR_LEGACY',
    key: 'post_complete',
    phase: 'post'
  },
  GRATITUDE: {
    id: 'GRATITUDE',
    question: "What are you grateful for in this journey?",
    nextStep: 'LEGACY_VISION',
    key: 'gratitude_practice',
    placeholder: "I'm grateful for...",
    phase: 'legacy'
  },
  LEGACY_VISION: {
    id: 'LEGACY_VISION',
    question: "What legacy do you want to leave behind?",
    nextStep: 'FEEDBACK_LOOP',
    key: 'legacy_vision',
    placeholder: "I want to be remembered for...",
    phase: 'legacy'
  },
  FEEDBACK_LOOP: {
    id: 'FEEDBACK_LOOP',
    question: "How do you want to receive feedback from your community?",
    nextStep: 'COMPLETE',
    key: 'feedback_loop',
    placeholder: "Email, social media, live chats...",
    phase: 'legacy'
  }
};

export function getStep(id: StepId): CurriculumStep {
  return CURRICULUM[id] || CURRICULUM.INIT;
}

/** V2 main flow only — walks INIT → nextStep → … → COMPLETE (excludes compatibility stubs). */
export function getCurriculumSpineOrder(): StepId[] {
  const order: StepId[] = []
  const visited = new Set<StepId>()
  let current: StepId = 'INIT'

  while (!visited.has(current)) {
    visited.add(current)
    order.push(current)
    const next: StepId = getStep(current).nextStep
    if (next === current) break
    current = next
  }

  return order
}

const PHASE_TOKEN_SKIP_STEP_IDS = new Set<StepId>([
  'INIT',
  'COMPLETE',
  'MISSION_GIFT',
  'PRE_COMPLETE',
  'PROJECT_NAME',
  'PROJECT_DESCRIPTION',
  'ASSET_UPLOAD_PANEL',
  'PROD_COMPLETE',
  'PROMO_STRATEGY',
  'TARGET_AUDIENCE',
  'LAUNCH_DATE',
  'POST_COMPLETE',
  'GRATITUDE',
  'LEGACY_VISION',
  'FEEDBACK_LOOP',
])

function isPhaseTokenCandidate(step: CurriculumStep): boolean {
  if (PHASE_TOKEN_SKIP_STEP_IDS.has(step.id)) return false
  if (step.id.includes('_COMPLETE')) return false
  return Boolean(step.key && step.key.length > 0)
}

/**
 * All answerable question keys for a phase, walking the V2 spine only.
 * Single source of truth for phase progress denominators - keeps token fill %
 * consistent with token-jump targets (findFirstUnansweredStepInPhase) and
 * excludes compatibility stubs that would inflate the count.
 */
export function getPhaseCandidateKeys(phase: 'pre' | 'prod' | 'post' | 'legacy'): string[] {
  const keys = new Set<string>()
  for (const stepId of getCurriculumSpineOrder()) {
    const step = getStep(stepId)
    if (step.phase !== phase) continue
    if (!isPhaseTokenCandidate(step)) continue
    keys.add(step.key)
  }
  return Array.from(keys)
}

/**
 * Find the first unanswered step in a specific phase
 * Used for token navigation - clicking a token jumps to first unanswered question of that phase
 */
export function findFirstUnansweredStepInPhase(
  phase: 'pre' | 'prod' | 'post' | 'legacy',
  answeredKeys: Set<string>
): StepId | null {
  for (const stepId of getCurriculumSpineOrder()) {
    const step = getStep(stepId)
    if (step.phase !== phase) continue
    if (!isPhaseTokenCandidate(step)) continue
    if (!answeredKeys.has(step.key)) {
      return step.id
    }
  }

  return null // All answered in this phase
}

