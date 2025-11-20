export enum OperationType {
  ADDITION = '+',
  SUBTRACTION = '-',
  MULTIPLICATION = '×',
  DIVISION = '÷',
  ALL = 'mix'
}

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  RESULTS = 'RESULTS'
}

export interface Question {
  id: string;
  num1: number;
  num2: number;
  operation: OperationType;
  correctAnswer: number;
  userAnswer?: number;
  isRetry: boolean; // If true, this is a spaced repetition appearance
}

export interface GameConfig {
  operation: OperationType;
  targetNumber: number | null; // null means all numbers 1-10
  durationPerQuestion: number; // seconds
}

export interface SessionStats {
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  startTime: number;
  endTime: number;
  averageTimePerQuestion: number;
}