export type StepId = 
  // PRE phase
  | 'INIT'
  | 'MISSION_NAME'
  | 'MISSION_GIFT'
  | 'LOGO_PANEL'
  | 'COLORS_PANEL'
  | 'FONT_PANEL'
  | 'PRE_COMPLETE'
  // PROD phase
  | 'PROJECT_NAME'
  | 'PROJECT_DESCRIPTION'
  | 'ASSET_UPLOAD_PANEL'
  | 'PROD_COMPLETE'
  // POST phase
  | 'PROMO_STRATEGY'
  | 'TARGET_AUDIENCE'
  | 'LAUNCH_DATE'
  | 'POST_COMPLETE'
  // LEGACY phase
  | 'GRATITUDE'
  | 'LEGACY_VISION'
  | 'FEEDBACK_LOOP'
  | 'COMPLETE';

export interface CurriculumStep {
  id: StepId;
  question: string;
  nextStep: StepId;
  key: string; // The key used in the database (curriculum_answers table)
  placeholder?: string;
  triggersPanel?: 'logo' | 'colors' | 'font' | 'asset'; // Panel to trigger after this step
  phase?: 'pre' | 'prod' | 'post' | 'legacy';
}

// The Deterministic "Script" for all phases
export const CURRICULUM: Record<StepId, CurriculumStep> = {
  // PRE Phase
  INIT: {
    id: 'INIT',
    question: "Welcome, My Champion! I am here to help you build your legacy. First things first: What is your artist name?",
    nextStep: 'COLORS_PANEL',
    key: 'artist_name',
    placeholder: "e.g. JAI, The Beatles...",
    phase: 'pre'
  },
  MISSION_NAME: {
    id: 'MISSION_NAME',
    question: "What is your artist name?",
    nextStep: 'COLORS_PANEL',
    key: 'artist_name',
    placeholder: "Your Artist Name",
    phase: 'pre'
  },
  COLORS_PANEL: {
    id: 'COLORS_PANEL',
    question: "Great! Now choose your brand colors.",
    nextStep: 'MISSION_GIFT',
    key: 'colors_set',
    triggersPanel: 'colors',
    phase: 'pre'
  },
  MISSION_GIFT: {
    id: 'MISSION_GIFT',
    question: "I love those colors. Now, tell me: What makes your presence a gift to the world?",
    nextStep: 'FONT_PANEL',
    key: 'gift_to_world',
    placeholder: "I bring energy/light/truth...",
    phase: 'pre'
  },
  FONT_PANEL: {
    id: 'FONT_PANEL',
    question: "Excellent! Now select your font.",
    nextStep: 'LOGO_PANEL',
    key: 'font_set',
    triggersPanel: 'font',
    phase: 'pre'
  },
  LOGO_PANEL: {
    id: 'LOGO_PANEL',
    question: "Perfect! Finally, upload your logo.",
    nextStep: 'PRE_COMPLETE',
    key: 'logo_uploaded',
    triggersPanel: 'logo',
    phase: 'pre'
  },
  PRE_COMPLETE: {
    id: 'PRE_COMPLETE',
    question: "Outstanding! Your foundation is set. Ready to create?",
    nextStep: 'PROJECT_NAME',
    key: 'pre_complete',
    phase: 'pre'
  },
  
  // PROD Phase
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
    nextStep: 'PROMO_STRATEGY',
    key: 'prod_complete',
    phase: 'prod'
  },
  
  // POST Phase
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
    nextStep: 'GRATITUDE',
    key: 'post_complete',
    phase: 'post'
  },
  
  // LEGACY Phase
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
  },
  COMPLETE: {
    id: 'COMPLETE',
    question: "Outstanding. Your legacy is defined. The Champion is proud.",
    nextStep: 'COMPLETE',
    key: 'completed',
    placeholder: "",
    phase: 'legacy'
  }
};

export function getStep(id: StepId): CurriculumStep {
  return CURRICULUM[id] || CURRICULUM.INIT;
}

