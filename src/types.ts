export type AppState = 'DASHBOARD' | 'LOADING_CHALLENGE' | 'PRACTICE' | 'GRADING' | 'FEEDBACK';

export interface Challenge {
  topicId: string;
  description: string;
  context: string;
  expectedCommandHint: string;
  expectedOutcomeCriteria: string;
  expectedReferenceSolution: string;
}

export interface GradingResult {
  correct: boolean;
  feedback: string;
  solution: string;
}

export type ProgressConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ProgressEvaluationResult {
  correct: boolean;
  summary: string;
  issues: string[];
  hints: string[];
  confidence: ProgressConfidence;
}

export interface HistoryItem {
  challenge: Challenge;
  result: GradingResult;
  submission: string;
}

export interface SessionState {
  selectedTopic: string | null;
  currentChallenge: Challenge | null;
  lastResult: GradingResult | null;
  history: HistoryItem[];
  recentChallengesByKey: Record<string, { description: string; context: string }[]>;
  seenChallengeFingerprintsByKey: Record<string, string[]>;
}
