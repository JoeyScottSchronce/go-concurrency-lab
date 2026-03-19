import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Code2,
  Play,
  RotateCcw,
  LogOut,
  CheckCircle2,
  XCircle,
  Loader2,
  Info,
  History,
  HelpCircle,
  X,
  Copy,
  Check,
  Workflow,
} from 'lucide-react';
import { CONCURRENCY_TOPIC_ID, APP_THEME } from './constants';
import { AppState, Challenge, SessionState, ProgressEvaluationResult } from './types';
import { evaluateProgress, generateChallenge, gradeSubmission } from './services/aiService';
import { makeTopicKey, fingerprintChallenge } from './utils/challengeFingerprint';
import { formatReferenceSolution } from './utils/formatReferenceSolution';

const MAX_GENERATION_RETRIES = 3;
const MAX_RECENT_CHALLENGES_TO_AVOID = 5;

export default function App() {
  const [appState, setAppState] = useState<AppState>('DASHBOARD');
  const [session, setSession] = useState<SessionState>({
    selectedTopic: null,
    currentChallenge: null,
    lastResult: null,
    history: [],
    recentChallengesByKey: {},
    seenChallengeFingerprintsByKey: {},
  });
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRunLoading, setIsRunLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [copied, setCopied] = useState(false);
  const [runFeedback, setRunFeedback] = useState<ProgressEvaluationResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [isRunFeedbackOpen, setIsRunFeedbackOpen] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (appState === 'PRACTICE' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [appState]);

  const generateNonRepeatingChallenge = async () => {
    const key = makeTopicKey(CONCURRENCY_TOPIC_ID);
    const avoidExactChallenges = (session.recentChallengesByKey[key] ?? []).slice(-MAX_RECENT_CHALLENGES_TO_AVOID);
    const seen = new Set(session.seenChallengeFingerprintsByKey[key] ?? []);

    let lastChallenge: Challenge | null = null;
    for (let attempt = 0; attempt < MAX_GENERATION_RETRIES; attempt++) {
      const challenge = await generateChallenge(CONCURRENCY_TOPIC_ID, { avoidExactChallenges });
      lastChallenge = challenge;
      const fp = fingerprintChallenge(challenge);
      if (!seen.has(fp)) return challenge;
    }

    return lastChallenge ?? (await generateChallenge(CONCURRENCY_TOPIC_ID, { avoidExactChallenges }));
  };

  const startConcurrencySession = async () => {
    const challenge = await generateNonRepeatingChallenge();
    setSession(prev => ({
      ...prev,
      selectedTopic: CONCURRENCY_TOPIC_ID,
      currentChallenge: challenge,
      lastResult: null,
      recentChallengesByKey: (() => {
        const key = makeTopicKey(CONCURRENCY_TOPIC_ID);
        const existing = prev.recentChallengesByKey[key] ?? [];
        const next = [...existing, { description: challenge.description, context: challenge.context }];
        return { ...prev.recentChallengesByKey, [key]: next.slice(-MAX_RECENT_CHALLENGES_TO_AVOID) };
      })(),
      seenChallengeFingerprintsByKey: (() => {
        const key = makeTopicKey(CONCURRENCY_TOPIC_ID);
        const fp = fingerprintChallenge(challenge);
        const existing = prev.seenChallengeFingerprintsByKey[key] ?? [];
        return {
          ...prev.seenChallengeFingerprintsByKey,
          [key]: existing.includes(fp) ? existing : [...existing, fp],
        };
      })(),
    }));
  };

  const handleStartConcurrency = async () => {
    setIsLoading(true);
    setAppState('LOADING_CHALLENGE');
    setError(null);
    try {
      await startConcurrencySession();
      setAppState('PRACTICE');
      setUserInput('');
    } catch (err) {
      setError('Could not start a challenge. Please try again.');
      setAppState('DASHBOARD');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!userInput.trim() || !session.currentChallenge || isLoading || isRunLoading) return;

    setIsLoading(true);
    setAppState('GRADING');
    try {
      const result = await gradeSubmission(session.currentChallenge, userInput);
      setSession(prev => ({
        ...prev,
        lastResult: result,
        history: [
          ...prev.history,
          {
            challenge: prev.currentChallenge!,
            result,
            submission: userInput,
          },
        ],
      }));
      setAppState('FEEDBACK');
    } catch (err) {
      setError('Grading failed. Please try again.');
      setAppState('PRACTICE');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const closeRunPopup = () => {
    setIsRunFeedbackOpen(false);
  };

  const handleRun = async () => {
    if (!userInput.trim() || !session.currentChallenge || isLoading || isRunLoading) return;

    setIsRunLoading(true);
    setRunError(null);
    try {
      const result = await evaluateProgress(session.currentChallenge, userInput);
      setRunFeedback(result);
      setIsRunFeedbackOpen(true);
    } catch (err) {
      setRunError('Run failed. Please try again.');
      setIsRunFeedbackOpen(true);
      console.error(err);
    } finally {
      setIsRunLoading(false);
    }
  };

  useEffect(() => {
    if (!isRunFeedbackOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRunPopup();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isRunFeedbackOpen]);

  const handleNextChallenge = async () => {
    setIsLoading(true);
    setAppState('LOADING_CHALLENGE');
    try {
      const challenge = await generateNonRepeatingChallenge();
      setSession(prev => ({
        ...prev,
        currentChallenge: challenge,
        lastResult: null,
        recentChallengesByKey: (() => {
          const key = makeTopicKey(CONCURRENCY_TOPIC_ID);
          const existing = prev.recentChallengesByKey[key] ?? [];
          const next = [...existing, { description: challenge.description, context: challenge.context }];
          return { ...prev.recentChallengesByKey, [key]: next.slice(-MAX_RECENT_CHALLENGES_TO_AVOID) };
        })(),
        seenChallengeFingerprintsByKey: (() => {
          const key = makeTopicKey(CONCURRENCY_TOPIC_ID);
          const fp = fingerprintChallenge(challenge);
          const existing = prev.seenChallengeFingerprintsByKey[key] ?? [];
          return {
            ...prev.seenChallengeFingerprintsByKey,
            [key]: existing.includes(fp) ? existing : [...existing, fp],
          };
        })(),
      }));
      setAppState('PRACTICE');
      setUserInput('');
    } catch (e) {
      console.error(e);
      setError('Failed to load next challenge.');
      setAppState('FEEDBACK');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuit = () => {
    setAppState('DASHBOARD');
    setSession({
      selectedTopic: null,
      currentChallenge: null,
      lastResult: null,
      history: [],
      recentChallengesByKey: {},
      seenChallengeFingerprintsByKey: {},
    });
    setUserInput('');
    setError(null);
  };

  return (
    <div
      className={`min-h-screen ${APP_THEME.bg} ${APP_THEME.text} ${APP_THEME.fontMono} p-4 md:p-8 flex flex-col items-center`}
    >
      <header
        className={`w-full max-w-4xl mb-8 flex justify-between items-center border-b ${APP_THEME.border} pb-4`}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <Workflow className={`w-8 h-8 ${APP_THEME.accent}`} />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full animate-pulse opacity-90" />
          </div>
          <h1 className="text-2xl font-bold tracking-tighter uppercase text-slate-100">Go Concurrency Lab</h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowHelp(true)}
            className={`${APP_THEME.accentMuted} hover:text-teal-300 transition-colors`}
            title="How to use"
            type="button"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
          {appState !== 'DASHBOARD' && (
            <button
              onClick={handleQuit}
              type="button"
              className={`flex items-center gap-2 px-3 py-1 border ${APP_THEME.border} hover:bg-teal-950/40 transition-colors text-sm text-teal-300`}
            >
              <LogOut className="w-4 h-4" />
              EXIT
            </button>
          )}
        </div>
      </header>

      <main className="w-full max-w-4xl flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {appState === 'DASHBOARD' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col flex-1 min-h-[60vh]"
            >
              <div className="flex-1 flex flex-col items-center justify-center gap-10 px-4">
                <div className="text-center max-w-lg">
                  <h2 className={`text-2xl md:text-3xl font-bold mb-3 text-slate-100 flex items-center justify-center gap-2`}>
                    <Code2 className={`w-8 h-8 ${APP_THEME.accent}`} />
                    GoRoutines &amp; Channels
                  </h2>
                  <p className={`${APP_THEME.accentMuted} text-sm md:text-base leading-relaxed`}>
                    Advanced coding challenges focused on concurrency with Goroutines, channels, select, sync, and context.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleStartConcurrency}
                  disabled={isLoading}
                  className={`group relative px-14 py-5 text-lg font-bold uppercase tracking-[0.2em] border-2 border-teal-500/60 bg-teal-950/30 text-teal-200 hover:bg-teal-900/40 hover:border-teal-400 transition-all disabled:opacity-50`}
                >
                  <span className="relative z-10">Begin</span>
                  {isLoading && (
                    <span className="absolute inset-0 flex items-center justify-center bg-[#0c0e0e]/80">
                      <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
                    </span>
                  )}
                </button>
              </div>

              {session.history.length > 0 && (
                <div className="w-full mt-16">
                  <div className={`flex items-center justify-between mb-6 border-b ${APP_THEME.border} pb-2`}>
                    <h2 className="text-xl flex items-center gap-2 text-slate-100">
                      <History className={`w-5 h-5 ${APP_THEME.accent}`} />
                      Recent activity
                    </h2>
                    <button
                      type="button"
                      onClick={() => setSession(prev => ({ ...prev, history: [] }))}
                      className="text-[10px] text-teal-600 hover:text-teal-400 transition-colors uppercase tracking-widest"
                    >
                      Clear log
                    </button>
                  </div>
                  <div className="space-y-3">
                    {session.history
                      .slice()
                      .reverse()
                      .map((item, idx) => (
                        <div
                          key={idx}
                          className={`p-4 border ${APP_THEME.border} ${APP_THEME.panel} flex items-center justify-between gap-4`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {item.result.correct ? (
                                <CheckCircle2 className={`w-3 h-3 ${APP_THEME.accent}`} />
                              ) : (
                                <XCircle className="w-3 h-3 text-amber-500" />
                              )}
                              <span className="text-xs font-bold text-slate-200 uppercase tracking-tighter">
                                {item.challenge.description.slice(0, 60)}...
                              </span>
                            </div>
                            <div className="font-mono text-[10px] text-slate-500 truncate">
                              {item.submission.split('\n')[0]}...
                            </div>
                          </div>
                          <div
                            className={`text-[10px] font-bold uppercase tracking-widest ${
                              item.result.correct ? 'text-teal-400' : 'text-amber-500'
                            }`}
                          >
                            {item.result.correct ? 'PASSED' : 'FAILED'}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {appState === 'LOADING_CHALLENGE' && (
            <motion.div
              key="loading-challenge"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center flex-1 py-20"
            >
              <div className="relative">
                <Loader2 className="w-16 h-16 animate-spin text-teal-500/20" />
                <Workflow className={`w-8 h-8 ${APP_THEME.accent} absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`} />
              </div>
              <h2 className="mt-8 text-2xl font-bold tracking-tighter uppercase animate-pulse text-slate-100">
                {session.currentChallenge ? 'Scheduling next challenge' : 'Starting the scheduler'}
              </h2>
              <p className={`mt-2 ${APP_THEME.accentMuted} text-sm tracking-widest uppercase`}>
                Warming up goroutines…
              </p>
            </motion.div>
          )}

          {(appState === 'PRACTICE' || appState === 'GRADING') && session.currentChallenge && (
            <motion.div
              key="practice"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-6 flex-1"
            >
              <div className={`p-6 border ${APP_THEME.border} ${APP_THEME.panel} rounded-sm`}>
                <h3 className="text-xl font-bold mb-4 text-slate-100 leading-tight">
                  {session.currentChallenge.description}
                </h3>
                <div className="bg-black/40 p-4 border-l-2 border-teal-600/50 mb-4">
                  <p className="text-sm italic text-slate-400">{session.currentChallenge.context}</p>
                </div>
                <div className={`text-xs ${APP_THEME.accentMuted}`}>
                  Hint: {session.currentChallenge.expectedCommandHint}
                </div>
              </div>

              <div
                className={`flex-1 flex flex-col border ${APP_THEME.border} bg-[#080a0a] rounded-sm overflow-hidden shadow-2xl`}
              >
                <div className={`${APP_THEME.panel} px-4 py-2 border-b ${APP_THEME.border} flex justify-between items-center`}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-amber-500/50" />
                    <div className="w-3 h-3 rounded-full bg-teal-500/50" />
                    <span className={`ml-2 text-[10px] ${APP_THEME.accentMuted} tracking-widest uppercase`}>main.go</span>
                  </div>
                  <div className={`text-[10px] ${APP_THEME.accentMuted} uppercase tracking-widest`}>Go 1.22+</div>
                </div>

                <div className="p-6 flex-1 flex flex-col font-mono text-lg relative">
                  <div className="relative h-full">
                    <textarea
                      ref={inputRef}
                      value={userInput}
                      onChange={e => setUserInput(e.target.value)}
                      disabled={appState === 'GRADING'}
                      rows={10}
                      className={`w-full bg-transparent border-none outline-none text-teal-50 caret-teal-400 resize-none leading-7 ${
                        appState === 'GRADING' ? 'opacity-0' : 'opacity-100'
                      }`}
                      autoFocus
                      spellCheck={false}
                      autoComplete="off"
                      placeholder={'// Write your Go solution here...\npackage main\n\nfunc main() {\n\t// ...\n}'}
                    />
                    {appState === 'GRADING' && (
                      <div className="absolute inset-0 bg-[#080a0a] flex items-center justify-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
                        <span className="text-lg animate-pulse text-teal-400 font-bold uppercase tracking-tighter">
                          Reviewing concurrency…
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleRun}
                      disabled={!userInput.trim() || appState === 'GRADING' || isLoading || isRunLoading}
                      className={`flex items-center gap-2 px-3 py-1.5 ${APP_THEME.panel} border ${APP_THEME.border} text-teal-200 font-bold hover:border-teal-500/50 disabled:opacity-50 transition-colors uppercase text-xs tracking-widest`}
                      title="Run progress check (hints only)"
                    >
                      {isRunLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Info className="w-3.5 h-3.5" />
                      )}
                      Run
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSubmit()}
                      disabled={!userInput.trim() || appState === 'GRADING' || isRunLoading}
                      className="flex items-center gap-2 px-6 py-2 bg-teal-500 text-black font-bold hover:bg-teal-400 disabled:opacity-50 disabled:hover:bg-teal-500 transition-colors uppercase text-sm tracking-tighter"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Submit
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {appState === 'FEEDBACK' && session.lastResult && (
            <motion.div
              key="feedback"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col gap-6 items-center justify-center flex-1 py-12 min-w-0 w-full"
            >
              <div
                className={`w-full max-w-2xl min-w-0 p-8 border ${
                  session.lastResult.correct
                    ? 'border-teal-500/50 bg-teal-950/20'
                    : 'border-amber-500/50 bg-amber-950/10'
                } rounded-sm flex flex-col`}
              >
                <div className="text-center">
                  <div className="flex justify-center mb-6">
                    {session.lastResult.correct ? (
                      <CheckCircle2 className={`w-16 h-16 ${APP_THEME.accent}`} />
                    ) : (
                      <XCircle className="w-16 h-16 text-amber-500" />
                    )}
                  </div>

                  <h2
                    className={`text-3xl font-bold mb-4 uppercase tracking-tighter ${
                      session.lastResult.correct ? 'text-teal-400' : 'text-amber-500'
                    }`}
                  >
                    {session.lastResult.correct ? 'Solution accepted' : 'That\'s not quite right'}
                  </h2>

                  <p className="text-lg text-slate-200 mb-8 leading-relaxed px-1">{session.lastResult.feedback}</p>
                </div>

                {!session.lastResult.correct && (
                  <div className="mb-8 w-full min-w-0 text-left">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <h4 className={`text-xs uppercase tracking-widest ${APP_THEME.accentMuted}`}>
                        Reference solution:
                      </h4>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(formatReferenceSolution(session.lastResult!.solution))
                        }
                        className="shrink-0 flex items-center gap-1 text-[10px] uppercase tracking-widest text-teal-600 hover:text-teal-400 transition-colors"
                      >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copied' : 'Copy code'}
                      </button>
                    </div>
                    <div className="bg-black/60 border border-teal-950/50 rounded-sm overflow-hidden w-full min-w-0">
                      <pre
                        className="m-0 max-h-[min(50vh,28rem)] overflow-x-auto overflow-y-auto p-4 text-sm leading-relaxed text-teal-200 whitespace-pre [tab-size:4]"
                        tabIndex={0}
                      >
                        <code className="block w-max min-w-full font-mono text-[13px] text-teal-100">
                          {formatReferenceSolution(session.lastResult.solution)}
                        </code>
                      </pre>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4 justify-center text-center">
                  <button
                    type="button"
                    onClick={handleNextChallenge}
                    className="flex items-center justify-center gap-2 px-8 py-3 bg-teal-500 text-black font-bold hover:bg-teal-400 transition-colors uppercase text-sm tracking-tighter"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {session.lastResult.correct ? 'Next challenge' : 'Retry task'}
                  </button>
                  <button
                    type="button"
                    onClick={handleQuit}
                    className={`flex items-center justify-center gap-2 px-8 py-3 border ${APP_THEME.borderStrong} hover:bg-teal-950/30 transition-colors uppercase text-sm tracking-tighter text-teal-300`}
                  >
                    <LogOut className="w-4 h-4" />
                    Back to start
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="mt-4 p-4 border border-red-500/30 bg-red-500/5 text-red-400 text-sm flex items-center gap-3">
            <XCircle className="w-5 h-5" />
            {error}
          </div>
        )}
      </main>

      <AnimatePresence>
        {isRunFeedbackOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={closeRunPopup}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className={`w-full max-w-xl bg-[#0a0c0c] border ${APP_THEME.borderStrong} p-6 md:p-8 relative`}
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Run feedback"
            >
              <button
                type="button"
                onClick={closeRunPopup}
                className={`absolute top-4 right-4 ${APP_THEME.accentMuted} hover:text-teal-300 transition-colors`}
                aria-label="Close run feedback"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-3 uppercase tracking-tighter text-slate-100">
                <Info className={`w-5 h-5 ${APP_THEME.accent}`} />
                Progress check
              </h3>

              {runError ? (
                <div className="p-4 border border-red-500/30 bg-red-500/5 text-red-400 text-sm flex items-center gap-3">
                  <XCircle className="w-5 h-5" />
                  {runError}
                </div>
              ) : runFeedback ? (
                <div className="space-y-5 text-sm leading-relaxed text-slate-300">
                  <div className={`border ${APP_THEME.border} ${APP_THEME.panel} p-4`}>
                    <div className={`text-[10px] uppercase tracking-widest ${APP_THEME.accentMuted} mb-2`}>
                      Summary · Confidence: {runFeedback.confidence}
                    </div>
                    <div>{runFeedback.summary}</div>
                  </div>

                  {!runFeedback.correct && runFeedback.issues.length > 0 && (
                    <div>
                      <div className={`text-[10px] uppercase tracking-widest ${APP_THEME.accentMuted} mb-2`}>
                        What’s currently wrong / missing
                      </div>
                      <ul className="list-disc list-inside space-y-1">
                        {runFeedback.issues.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!runFeedback.correct && runFeedback.hints.length > 0 && (
                    <div>
                      <div className={`text-[10px] uppercase tracking-widest ${APP_THEME.accentMuted} mb-2`}>
                        Hints (no solutions)
                      </div>
                      <ul className="list-disc list-inside space-y-1">
                        {runFeedback.hints.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className={`text-[10px] uppercase tracking-widest ${APP_THEME.accentMuted}`}>
                    Tip: close this popup (Esc, click outside, or the X) and keep iterating.
                  </div>
                </div>
              ) : (
                <div className="text-slate-400 text-sm flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
                  Loading…
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowHelp(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`w-full max-w-lg bg-[#0a0c0c] border ${APP_THEME.borderStrong} p-8 relative`}
              onClick={e => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className={`absolute top-4 right-4 ${APP_THEME.accentMuted} hover:text-teal-300 transition-colors`}
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 uppercase tracking-tighter text-slate-100">
                <HelpCircle className={`w-6 h-6 ${APP_THEME.accent}`} />
                How this lab works
              </h2>

              <div className="space-y-6 text-sm leading-relaxed text-slate-400">
                <section>
                  <h3 className="text-teal-400 font-bold mb-2 uppercase tracking-widest text-xs">01. Start</h3>
                  <p>
                    Tap <strong className="text-slate-300">Concurrency</strong> on the home screen. Each challenge is generated around Go
                    concurrency: goroutines, channels, select, sync, and context.
                  </p>
                </section>

                <section>
                  <h3 className="text-teal-400 font-bold mb-2 uppercase tracking-widest text-xs">02. Write Go</h3>
                  <p>
                    Implement the task in the editor. Think about synchronization, channel direction, cancellation, and races—not just
                    compiling code.
                  </p>
                </section>

                <section>
                  <h3 className="text-teal-400 font-bold mb-2 uppercase tracking-widest text-xs">03. Run &amp; submit</h3>
                  <p>
                    Use <strong className="text-slate-300">Run</strong> for a hint-style progress check (no full solutions).{' '}
                    <strong className="text-slate-300">Submit</strong> for full grading and feedback.
                  </p>
                </section>

                <div className={`pt-4 border-t ${APP_THEME.border}`}>
                  <p className={`italic text-[10px] uppercase tracking-widest ${APP_THEME.accentMuted}`}>
                    The model may accept different idiomatic approaches; correctness and concurrency behavior matter most.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="w-full mt-8 py-3 bg-teal-500 text-black font-bold hover:bg-teal-400 transition-colors uppercase text-xs tracking-widest"
              >
                Understood
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer
        className={`w-full max-w-4xl mt-12 pt-4 border-t ${APP_THEME.border} flex justify-between items-center text-[10px] text-teal-700/80 uppercase tracking-[0.2em]`}
      >
        <div>Runtime: idle</div>
        <div>&copy; {new Date().getFullYear()} Go Concurrency Lab</div>
      </footer>
    </div>
  );
}
