import { OperationType, Question } from '../types';

export const generateQuestionBatch = (
  operation: OperationType,
  targetNumber: number | null,
  count: number = 20
): Question[] => {
  const questions: Question[] = [];
  const operations = [
    OperationType.ADDITION,
    OperationType.SUBTRACTION,
    OperationType.MULTIPLICATION,
    OperationType.DIVISION
  ];

  for (let i = 0; i < count; i++) {
    let op = operation;
    if (operation === OperationType.ALL) {
      op = operations[Math.floor(Math.random() * operations.length)];
    }

    // Determine operands
    // If targetNumber is set, one operand must be that number (mostly for multiplication/division)
    // For addition/subtraction, we keep numbers simpler (1-20)
    
    let n1 = 0;
    let n2 = 0;
    let ans = 0;

    if (targetNumber !== null) {
        // Specific table practice
        n2 = targetNumber;
        n1 = Math.floor(Math.random() * 10) + 1; // 1 to 10
    } else {
        // Random practice
        n1 = Math.floor(Math.random() * 10) + 1;
        n2 = Math.floor(Math.random() * 10) + 1;
    }

    switch (op) {
        case OperationType.ADDITION:
            ans = n1 + n2;
            break;
        case OperationType.SUBTRACTION:
            // Ensure positive result
            if (n1 < n2) [n1, n2] = [n2, n1];
            ans = n1 - n2;
            break;
        case OperationType.MULTIPLICATION:
            ans = n1 * n2;
            break;
        case OperationType.DIVISION:
            // Inverse multiplication to get clean integers
            ans = n1; // The answer will be n1
            const dividend = n1 * n2;
            n1 = dividend; 
            // Now: (n1 * n2) / n2 = n1. 
            // So displayed question is n1 / n2 = ?
            break;
    }

    // Randomize order for + and * if using specific target to vary position
    if ((op === OperationType.ADDITION || op === OperationType.MULTIPLICATION) && Math.random() > 0.5) {
        [n1, n2] = [n2, n1];
    }

    questions.push({
      id: `q-${Date.now()}-${i}`,
      num1: n1,
      num2: n2,
      operation: op,
      correctAnswer: ans,
      isRetry: false
    });
  }

  return questions;
};

export const formatTime = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};