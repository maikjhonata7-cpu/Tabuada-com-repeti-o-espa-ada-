import React, { useState, useCallback, useEffect } from 'react';
import { Play, RotateCcw, Trophy, X, ArrowRight, AlertCircle, Calculator, Clock, Loader } from 'lucide-react';
import { GoogleGenAI, Modality } from "@google/genai";
import { GameState, OperationType, GameConfig, Question, SessionStats } from './types';
import { generateQuestionBatch } from './services/gameService';
import { playCorrectSound, playWrongSound, playCompletionSound } from './services/soundService';
import CircularTimer from './components/CircularTimer';
import Keypad from './components/Keypad';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [config, setConfig] = useState<GameConfig>({
    operation: OperationType.MULTIPLICATION,
    targetNumber: null,
    durationPerQuestion: 10, // default seconds
  });
  
  // Game State
  const [questionQueue, setQuestionQueue] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | 'timeout' | null>(null);
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    totalQuestions: 0,
    correctCount: 0,
    wrongCount: 0,
    startTime: 0,
    endTime: 0,
    averageTimePerQuestion: 0
  });

  const [rewardImage, setRewardImage] = useState<string | null>(null);
  const [isRewardLoading, setIsRewardLoading] = useState(false);

  // --- Handlers: Setup ---

  const startGame = (customQueue?: Question[]) => {
    const questions = customQueue || generateQuestionBatch(config.operation, config.targetNumber, 10);
    setQuestionQueue(questions);
    setCurrentQIndex(0);
    setUserInput('');
    setFeedback(null);
    setSessionStats({
      totalQuestions: questions.length,
      correctCount: 0,
      wrongCount: 0,
      startTime: Date.now(),
      endTime: 0,
      averageTimePerQuestion: 0
    });
    setGameState(GameState.PLAYING);
    
    // Initialize audio context on user interaction
    playCorrectSound(); 
  };

  const selectOperation = (op: OperationType) => setConfig(prev => ({ ...prev, operation: op }));
  const selectTarget = (num: number | null) => setConfig(prev => ({ ...prev, targetNumber: num }));
  const selectDuration = (sec: number) => setConfig(prev => ({ ...prev, durationPerQuestion: sec }));

  // --- Handlers: Gameplay ---

  const handleInput = (num: string) => {
    // Block input if showing feedback
    if (feedback) return;

    const currentQ = questionQueue[currentQIndex];
    if (!currentQ) return;

    const correctStr = currentQ.correctAnswer.toString();
    // Prevent typing more digits than the answer has
    if (userInput.length >= correctStr.length) return;

    const nextInput = userInput + num;
    setUserInput(nextInput);

    // Auto-submit logic: Check when length matches
    if (nextInput.length === correctStr.length) {
        const userVal = parseInt(nextInput);
        
        // Store user answer for review later
        const updatedQueue = [...questionQueue];
        updatedQueue[currentQIndex].userAnswer = userVal;
        setQuestionQueue(updatedQueue);

        processAnswer(userVal, false);
    }
  };

  const handleDelete = () => {
    if (feedback) return;
    setUserInput(prev => prev.slice(0, -1));
  };

  const processAnswer = useCallback((userVal: number | null, isTimeout: boolean) => {
    const currentQ = questionQueue[currentQIndex];
    if (!currentQ) return;
    
    // If timeout, ensure we mark it as such
    const valToCheck = userVal !== null ? userVal : -999; // -999 is just a dummy for timeout
    const isCorrect = !isTimeout && valToCheck === currentQ.correctAnswer;

    if (isCorrect) {
      setFeedback('correct');
      playCorrectSound();
      setSessionStats(prev => ({ ...prev, correctCount: prev.correctCount + 1 }));
      
      setTimeout(() => {
        nextQuestion();
      }, 600); // Fast transition for correct
    } else {
      setFeedback(isTimeout ? 'timeout' : 'wrong');
      playWrongSound();
      setSessionStats(prev => ({ ...prev, wrongCount: prev.wrongCount + 1 }));
      
      // Spaced Repetition Logic for wrong answers
      const newQueue = [...questionQueue];
      const retryQ = { 
          ...currentQ, 
          userAnswer: undefined, // Reset answer for the retry
          isRetry: true, 
          id: currentQ.id + '-retry-' + Date.now() 
      };
      
      // Add retry to end of queue so they practice it again
      newQueue.push(retryQ);
      setQuestionQueue(newQueue);

      // Longer delay for error so they can see the correct answer
      setTimeout(() => {
        nextQuestion();
      }, 2500); 
    }
  }, [questionQueue, currentQIndex]);

  const nextQuestion = () => {
    setFeedback(null);
    setUserInput('');
    
    if (currentQIndex >= questionQueue.length - 1) {
      finishGame();
    } else {
      setCurrentQIndex(prev => prev + 1);
    }
  };

  const finishGame = () => {
    playCompletionSound();
    setSessionStats(prev => ({ ...prev, endTime: Date.now() }));
    setGameState(GameState.RESULTS);
  };

  const startReview = () => {
      const wrongQuestionsMap = new Map();
      questionQueue.forEach(q => {
          if (q.userAnswer !== undefined && q.userAnswer !== q.correctAnswer) {
              if (!wrongQuestionsMap.has(q.id.split('-retry')[0])) { 
                  wrongQuestionsMap.set(q.id, {
                      ...q,
                      id: `review-${q.id}`,
                      userAnswer: undefined,
                      isRetry: false
                  });
              }
          }
      });
      const wrongQuestions = Array.from(wrongQuestionsMap.values());
      
      if (wrongQuestions.length > 0) {
          startGame(wrongQuestions);
      }
  };

  const generateReward = async () => {
    if (!process.env.API_KEY) return;
    setIsRewardLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: 'A cute 3D cartoon robot holding a golden trophy cup, jumping for joy, vibrant colors, soft lighting, simple background',
            },
          ],
        },
        config: {
          responseModalities: [Modality.IMAGE],
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const base64ImageBytes: string = part.inlineData.data;
          const imageUrl = `data:image/png;base64,${base64ImageBytes}`;
          setRewardImage(imageUrl);
        }
      }
    } catch (error) {
      console.error("Failed to generate reward", error);
    } finally {
      setIsRewardLoading(false);
    }
  };

  useEffect(() => {
    if (gameState === GameState.RESULTS && sessionStats.wrongCount === 0) {
      generateReward();
    } else if (gameState !== GameState.RESULTS) {
      setRewardImage(null);
      setIsRewardLoading(false);
    }
  }, [gameState, sessionStats.wrongCount]);

  // --- Styles Helper ---
  const getOperationButtonStyle = (op: OperationType, isSelected: boolean) => {
    const baseStyle = "aspect-square rounded-2xl text-3xl font-bold shadow-sm transition-all duration-200 flex items-center justify-center outline-none border";
    
    if (!isSelected) {
        // Unselected: White bg with colored icon text
        let textColor = "text-gray-400";
        if (op === OperationType.ADDITION) textColor = "text-blue-500";
        if (op === OperationType.SUBTRACTION) textColor = "text-orange-500";
        if (op === OperationType.MULTIPLICATION) textColor = "text-purple-500";
        if (op === OperationType.DIVISION) textColor = "text-cyan-500";
        
        return `${baseStyle} bg-white border-gray-100 hover:border-gray-200 hover:shadow-md ${textColor}`;
    }

    // Selected: Solid color background
    switch (op) {
        case OperationType.ADDITION:
            return `${baseStyle} bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-200 scale-105`;
        case OperationType.SUBTRACTION:
            return `${baseStyle} bg-orange-400 text-white border-orange-400 shadow-lg shadow-orange-200 scale-105`;
        case OperationType.MULTIPLICATION:
            return `${baseStyle} bg-purple-500 text-white border-purple-500 shadow-lg shadow-purple-200 scale-105`;
        case OperationType.DIVISION:
            return `${baseStyle} bg-cyan-400 text-white border-cyan-400 shadow-lg shadow-cyan-200 scale-105`;
        case OperationType.ALL:
            return `${baseStyle} bg-slate-500 text-white border-slate-500 shadow-lg shadow-slate-200 scale-105`;
        default:
            return baseStyle;
    }
  };

  const getTableButtonStyle = (num: number | null, isSelected: boolean) => {
      const base = "aspect-square rounded-xl text-lg font-bold shadow-sm transition-all duration-200 outline-none flex items-center justify-center border";
      if (isSelected) {
          return `${base} bg-indigo-600 text-white border-indigo-600 shadow-indigo-200 shadow-lg scale-105 z-10`;
      }
      return `${base} bg-white text-gray-600 border-gray-100 hover:border-gray-200 hover:shadow-md`;
  };

  const getTimeButtonStyle = (sec: number, isSelected: boolean) => {
      const base = "h-12 rounded-xl text-sm font-bold shadow-sm transition-all duration-200 outline-none flex items-center justify-center border gap-2";
      if (isSelected) {
          return `${base} bg-indigo-600 text-white border-indigo-600 shadow-indigo-200 shadow-lg scale-105`;
      }
      return `${base} bg-white text-slate-500 border-slate-200 hover:border-indigo-200 hover:text-indigo-600`;
  };

  // --- Renderers ---

  if (gameState === GameState.MENU) {
    return (
      <div className="min-h-screen bg-[#F0FDF4] flex flex-col p-6 max-w-md mx-auto font-sans text-gray-800">
        <header className="mb-8 text-center pt-8 flex flex-col items-center">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-5">
            <Calculator className="text-indigo-600" size={36} strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-black text-slate-800 mb-1 tracking-tight">Tabuada L&L</h1>
          <p className="text-gray-500 font-medium text-sm">Vamos treinar?</p>
        </header>

        <main className="flex-1 flex flex-col gap-8">
          {/* Operation Selector */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 tracking-wider pl-1">Escolha a Operação</h3>
            <div className="grid grid-cols-4 gap-4 px-1">
              <button onClick={() => selectOperation(OperationType.ADDITION)} className={getOperationButtonStyle(OperationType.ADDITION, config.operation === OperationType.ADDITION)}>+</button>
              <button onClick={() => selectOperation(OperationType.SUBTRACTION)} className={getOperationButtonStyle(OperationType.SUBTRACTION, config.operation === OperationType.SUBTRACTION)}>-</button>
              <button onClick={() => selectOperation(OperationType.MULTIPLICATION)} className={getOperationButtonStyle(OperationType.MULTIPLICATION, config.operation === OperationType.MULTIPLICATION)}>×</button>
              <button onClick={() => selectOperation(OperationType.DIVISION)} className={getOperationButtonStyle(OperationType.DIVISION, config.operation === OperationType.DIVISION)}>÷</button>
            </div>
          </section>

          {/* Number Selector */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 tracking-wider pl-1">Escolha a Tabuada</h3>
            <div className="grid grid-cols-5 gap-3 px-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                <button
                  key={num}
                  onClick={() => selectTarget(num)}
                  className={getTableButtonStyle(num, config.targetNumber === num)}
                >
                  {num}
                </button>
              ))}
              <button
                  onClick={() => selectTarget(null)}
                  className={`col-span-5 mt-4 h-14 rounded-2xl text-xs font-bold tracking-[0.2em] uppercase transition-all duration-300 flex items-center justify-center border
                    ${config.targetNumber === null 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-200 shadow-lg scale-[1.02]' 
                      : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300 hover:text-indigo-600 hover:bg-slate-50'}`}
               >
                  Todas as Tabuadas
              </button>
            </div>
          </section>

          {/* Time Selector */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 tracking-wider pl-1">Tempo de Resposta</h3>
            <div className="grid grid-cols-2 gap-4 px-1">
              <button
                onClick={() => selectDuration(5)}
                className={getTimeButtonStyle(5, config.durationPerQuestion === 5)}
              >
                <Clock size={16} strokeWidth={2.5} /> 5 Segundos
              </button>
              <button
                onClick={() => selectDuration(10)}
                className={getTimeButtonStyle(10, config.durationPerQuestion === 10)}
              >
                <Clock size={16} strokeWidth={2.5} /> 10 Segundos
              </button>
            </div>
          </section>

          <button
            onClick={() => startGame()}
            className="mt-auto w-full bg-emerald-500 hover:bg-emerald-600 text-white h-14 rounded-xl text-lg font-bold tracking-wide shadow-lg shadow-emerald-200 active:scale-95 transition-all flex items-center justify-center gap-2 uppercase"
          >
            <Play fill="currentColor" size={20} /> Começar
          </button>
        </main>
      </div>
    );
  }

  if (gameState === GameState.PLAYING) {
    const currentQ = questionQueue[currentQIndex];
    // Safety check to prevent crash if queue is somehow empty
    if (!currentQ) return null; 

    const progress = ((currentQIndex) / questionQueue.length) * 100;

    // Determine context text
    let contextText = "Tabuada Aleatória";
    if (config.targetNumber) contextText = `Tabuada do ${config.targetNumber}`;

    return (
      <div className="h-full bg-slate-50 flex flex-col max-w-md mx-auto relative overflow-hidden font-sans">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 pt-6 pb-2">
          <button 
            onClick={() => setGameState(GameState.MENU)} 
            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors"
          >
             <X size={24} />
          </button>
          
          <div className="px-4 py-1.5 bg-slate-200/50 rounded-full">
            <span className="text-xs font-bold text-slate-500">
              {currentQIndex + 1} / {questionQueue.length}
            </span>
          </div>

          <div>
            <CircularTimer
                duration={config.durationPerQuestion}
                isPlaying={!feedback}
                onTimeUp={() => processAnswer(null, true)}
                resetKey={currentQ.id}
            />
          </div>
        </div>

        {/* Main Question Card */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-8">
            
            <div className="w-full bg-white rounded-[2.5rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] border border-slate-100 p-8 flex flex-col items-center relative overflow-hidden min-h-[340px]">
                
                {/* ERROR OVERLAY (Red Card) */}
                {(feedback === 'wrong' || feedback === 'timeout') && (
                    <div className="absolute inset-0 bg-[#EF4444] z-20 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-300 text-white">
                        <div className="w-20 h-20 rounded-full border-4 border-white/30 flex items-center justify-center mb-4 shadow-sm">
                            <X size={40} strokeWidth={3} className="text-white" />
                        </div>
                        <p className="text-red-100 font-medium text-lg mb-0">A resposta era:</p>
                        <p className="text-[5rem] leading-none font-black tracking-tight drop-shadow-sm mt-2">{currentQ.correctAnswer}</p>
                    </div>
                )}

                {/* Top Gradient Line */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-20"></div>

                {/* Retry Badge */}
                {currentQ.isRetry && (
                  <div className="mb-4 bg-amber-100 text-amber-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    Revisão
                  </div>
                )}

                {/* Context Title */}
                <h2 className="text-slate-400 text-xs font-bold tracking-[0.2em] uppercase mb-6">
                    {contextText}
                </h2>

                {/* Equation */}
                <div className="flex items-center gap-3 text-[4.5rem] leading-none font-black text-slate-800 mb-8 tracking-tight">
                    <span>{currentQ.num1}</span>
                    <span className="text-indigo-500 text-[3.5rem] mt-2">{currentQ.operation}</span>
                    <span>{currentQ.num2}</span>
                </div>

                {/* Input Placeholder Area */}
                {feedback === 'correct' ? (
                   <div className="h-20 flex items-center justify-center">
                     <div className="text-emerald-500 text-5xl font-black animate-bounce">
                       {userInput || currentQ.correctAnswer}
                     </div>
                   </div>
                ) : (
                   <div className="h-20 flex items-center justify-center text-slate-300">
                      <span className="text-5xl font-bold">
                         {userInput ? <span className="text-slate-800">{userInput}</span> : '?'}
                      </span>
                      {!userInput && <span className="animate-pulse ml-1 w-0.5 h-10 bg-slate-300 rounded-full"></span>}
                   </div>
                )}

            </div>

        </div>

        {/* Keypad Area */}
        <div className="bg-slate-50 pb-4 pt-2">
            <Keypad
                onPress={handleInput}
                onDelete={handleDelete}
                disabled={feedback !== null}
            />
        </div>
      </div>
    );
  }

  if (gameState === GameState.RESULTS) {
    const accuracy = Math.round((sessionStats.correctCount / sessionStats.totalQuestions) * 100);
    const duration = sessionStats.endTime - sessionStats.startTime;
    const avgTime = (duration / sessionStats.totalQuestions) / 1000;

    // Get unique wrong questions for list display
    const wrongQuestionsMap = new Map();
    questionQueue.forEach(q => {
        if (q.userAnswer !== undefined && q.userAnswer !== q.correctAnswer) {
            if (!wrongQuestionsMap.has(q.id.split('-retry')[0])) { // avoid dupes from retries
                wrongQuestionsMap.set(q.id, q);
            }
        }
    });
    const wrongQuestions = Array.from(wrongQuestionsMap.values());
    const hasErrors = wrongQuestions.length > 0;

    return (
      <div className="min-h-screen bg-[#F8FAFC] p-6 max-w-md mx-auto flex flex-col animate-in fade-in slide-in-from-bottom-8 duration-500">
        <header className="text-center mt-8 mb-8 relative">
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-yellow-200/30 rounded-full blur-2xl pointer-events-none"></div>
            <Trophy className="text-yellow-500 w-20 h-20 mx-auto mb-4 drop-shadow-lg" fill="#fbbf24" />
            <h1 className="text-2xl font-black text-slate-800 mb-1">Sessão Concluída!</h1>
            <p className="text-slate-500 font-medium">
                {hasErrors ? 'Que tal revisar alguns pontos?' : 'Você dominou a tabuada!'}
            </p>
        </header>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white p-4 rounded-2xl text-center shadow-sm border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Precisão</p>
                <p className="text-3xl font-black text-green-500">{accuracy}%</p>
            </div>
            <div className="bg-white p-4 rounded-2xl text-center shadow-sm border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Tempo Médio</p>
                <div className="flex items-center justify-center gap-1 text-indigo-600">
                    <Clock size={16} strokeWidth={3} />
                    <p className="text-3xl font-black">{avgTime.toFixed(1)}s</p>
                </div>
            </div>
        </div>

        {/* Review / Message Area */}
        <div className="flex-1 bg-white rounded-3xl p-5 shadow-sm border border-slate-100 mb-6 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-purple-400"></div>
            
            {hasErrors ? (
                <>
                    <div className="flex items-center gap-2 mb-4 text-orange-500">
                        <AlertCircle size={20} />
                        <h3 className="font-bold text-sm uppercase tracking-wide">Pontos de Atenção</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {wrongQuestions.map((q, idx) => (
                             <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="flex items-center gap-2 font-bold text-slate-600">
                                    <span>{q.num1}</span>
                                    <span className="text-indigo-500">{q.operation}</span>
                                    <span>{q.num2}</span>
                                    <span>=</span>
                                    <span className="text-green-600">{q.correctAnswer}</span>
                                </div>
                                <div className="text-red-400 font-bold line-through decoration-2 opacity-60 text-sm">
                                    {q.userAnswer === -999 ? '...' : q.userAnswer}
                                </div>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={startReview}
                        className="mt-4 w-full bg-orange-100 hover:bg-orange-200 text-orange-600 h-12 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
                    >
                         Revisar {wrongQuestions.length} Erros <ArrowRight size={16} />
                    </button>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                     {isRewardLoading ? (
                       <div className="flex flex-col items-center">
                         <Loader className="animate-spin text-indigo-500 mb-2" size={32} />
                         <p className="text-slate-400 text-xs">Gerando prêmio...</p>
                       </div>
                     ) : rewardImage ? (
                       <div className="w-full h-full flex flex-col items-center animate-in fade-in duration-700">
                          <img src={rewardImage} alt="Reward" className="w-40 h-40 object-contain rounded-lg mb-2 shadow-sm" />
                          <p className="text-indigo-600 font-bold text-sm">Parabéns!</p>
                       </div>
                     ) : (
                        <>
                          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-3">
                              <Play className="text-indigo-500 ml-1" size={28} />
                          </div>
                          <p className="text-slate-800 font-bold text-lg mb-1">Prêmio da IA</p>
                          <p className="text-slate-400 text-sm max-w-[200px]">
                              Continue praticando para manter sua mente afiada!
                          </p>
                        </>
                     )}
                </div>
            )}
        </div>

        <button
            onClick={() => setGameState(GameState.MENU)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-14 rounded-xl text-lg font-bold shadow-lg shadow-indigo-200 active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-wide"
        >
            <RotateCcw size={20} /> Jogar Novamente
        </button>
      </div>
    );
  }

  return null;
}