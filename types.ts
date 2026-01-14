
export type CharacterType = 'AGGRESSIVE' | 'STRUCTURED' | 'DETAIL' | 'DISTRACTOR';

export interface Character {
  id: string;
  name: string;
  role: CharacterType;
  personality: string;
  avatar: string;
  color: string;
}

export interface Message {
  id: string;
  senderId: string; // 'user' or Character.id
  senderName: string;
  content: string;
  timestamp: number;
  type: 'system' | 'message';
}

export interface FeedbackData {
  timing: string;
  voiceShare: number; // 0-100
  structuralContribution: string;
  interruptionHandling: string;
  overallScore: number;
  suggestions: string[];
}

export interface SimulationState {
  topic: string;
  jobTitle: string;
  company: string;
  messages: Message[];
  status: 'IDLE' | 'SETTING_UP' | 'DISCUSSING' | 'FINISHED';
  activeCharacterId: string | null;
  round: number;
}
