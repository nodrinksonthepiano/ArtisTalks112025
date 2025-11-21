export type StepId = 'INIT' | 'MISSION_NAME' | 'MISSION_GIFT' | 'COMPLETE';

export interface CurriculumStep {
  id: StepId;
  question: string;
  nextStep: StepId;
  key: string; // The key used in the database (curriculum_answers table)
  placeholder?: string;
}

// The Deterministic "Script" for Act I
export const CURRICULUM: Record<StepId, CurriculumStep> = {
  INIT: {
    id: 'INIT',
    question: "Welcome, My Champion! I am here to help you build your legacy. First things first: What is your artist name?",
    nextStep: 'MISSION_GIFT',
    key: 'artist_name',
    placeholder: "e.g. JAI, The Beatles..."
  },
  MISSION_NAME: { // Just an alias/fallback if needed, but INIT starts us off
    id: 'MISSION_NAME',
    question: "What is your artist name?",
    nextStep: 'MISSION_GIFT',
    key: 'artist_name',
    placeholder: "Your Artist Name"
  },
  MISSION_GIFT: {
    id: 'MISSION_GIFT',
    question: "I love that name. Now, tell me: What makes your presence a gift to the world?",
    nextStep: 'COMPLETE', // For this first test, we stop here
    key: 'gift_to_world',
    placeholder: "I bring energy/light/truth..."
  },
  COMPLETE: {
    id: 'COMPLETE',
    question: "Outstanding. We have begun.",
    nextStep: 'COMPLETE',
    key: 'completed',
    placeholder: ""
  }
};

export function getStep(id: StepId): CurriculumStep {
  return CURRICULUM[id] || CURRICULUM.INIT;
}

