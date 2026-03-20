import { GoogleGenAI, Type } from "@google/genai";
import { Challenge, GradingResult, ProgressEvaluationResult } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });

function cleanJsonResponse(text: string): string {
  return text.replace(/```json\n?/, "").replace(/\n?```/, "").trim();
}

function looksLikeCodeOrSolution(text: string): boolean {
  if (/```/m.test(text)) return true;
  if (/^\s*(def|class)\s+\w+/m.test(text)) return true;
  if (/^\s*for\s+\w+\s+in\s+/m.test(text)) return true;
  if (/^\s*while\s+.+:/m.test(text)) return true;
  if (/^\s*func\s+(\([^)]*\)\s*)?\w+\s*\(/m.test(text)) return true;
  if (/^\s*go\s+[\w(]/m.test(text)) return true;
  if (/\bchan\s+[\w\[\]]+/m.test(text)) return true;
  if (/^\s*select\s*\{/m.test(text)) return true;
  return false;
}

function sanitizeProgressEvaluation(result: ProgressEvaluationResult): ProgressEvaluationResult {
  const combined = [
    result.summary,
    ...(result.issues ?? []),
    ...(result.hints ?? []),
  ].join("\n");

  if (looksLikeCodeOrSolution(combined)) {
    return {
      correct: false,
      summary:
        "I can’t show code or a full solution here, but I can still help you spot what to improve.",
      issues: [
        "Your current attempt is missing one or more key pieces required by the prompt (or has a logical mismatch).",
      ],
      hints: [
        "Re-read the challenge and verify your synchronization or channel behavior matches the spec.",
        "Check edge cases (zero workers, closed channels, context cancellation, races).",
        "Make sure you’re using the right Go concurrency primitives (goroutines, channels, select, sync, context).",
      ],
      confidence: "LOW",
    };
  }

  if (result.correct) {
    return {
      ...result,
      summary:
        result.summary?.trim().length > 0
          ? result.summary
          : "Your answer looks correct. Go ahead and submit it.",
      issues: [],
      hints: [],
    };
  }

  return result;
}

type AvoidChallenge = Pick<Challenge, "description" | "context">;

export async function generateChallenge(
  topicId: string,
  options?: {
    avoidExactChallenges?: AvoidChallenge[];
  }
): Promise<Challenge> {
  const avoidBlock =
    options?.avoidExactChallenges && options.avoidExactChallenges.length > 0
      ? `\n\nDo NOT repeat any of the following challenges exactly (same task/wording). Generate a different task:\n${options.avoidExactChallenges
          .slice(0, 5)
          .map(
            (c, idx) =>
              `${idx + 1}. Description: ${c.description}\n   Context: ${c.context}`
          )
          .join("\n")}`
      : "";

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: `Generate a simple Go programming challenge for the topic identifier: ${topicId}.

The challenge MUST focus on Go concurrency: goroutines, channels (send/receive, buffering, closing, ranging), select, sync.WaitGroup, sync.Mutex and sync.RWMutex, context.Context (cancellation/deadlines), time.After / time.Ticker when relevant, worker pools, pipelines, and happens-before reasoning.
Do NOT make the primary learning goal non-concurrency Go (e.g. structs-only or JSON-only); minimal setup code is OK.

Requirements:
- The user completes the task by writing a simple Go code snippet (package main with func main() is fine unless you specify otherwise).
- The challenge must require thinking about entry-level concurrency concepts (races, synchronization, channel patterns, or context).
- Provide a description of the task and environment/context (variables, constraints).
- Include expectedOutcomeCriteria: concise behavioral success criteria (no code).
- Include expectedReferenceSolution: a canonical Go reference solution.${avoidBlock}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING, description: "Clear description of what the user needs to do." },
          context: { type: Type.STRING, description: "Environment context (e.g. 'You must print results in order…', 'Workers read jobs from…')." },
          expectedCommandHint: { type: Type.STRING, description: "A small generic hint about primitives to consider (goroutine, channel, select, WaitGroup, Mutex, context) without giving the full answer." },
          expectedOutcomeCriteria: {
            type: Type.STRING,
            description: "Behavioral success criteria for a correct solution (no code).",
          },
          expectedReferenceSolution: {
            type: Type.STRING,
            description:
              "Canonical Go reference for the evaluator: multi-line, gofmt-style indentation, newlines between blocks—plain source, no markdown fences.",
          },
        },
        required: [
          "description",
          "context",
          "expectedCommandHint",
          "expectedOutcomeCriteria",
          "expectedReferenceSolution",
        ]
      },
      systemInstruction: "You are an expert Go concurrency tutor, instructing junior developers. You generate concise, entry-level educational coding challenges that require either goroutines, channels, select, sync, and/or context. Prefer realistic concurrency patterns at a basic level (worker pools, fan-in/fan-out, cancellation). Use idiomatic Go."
    }
  });

  try {
    const cleanedText = cleanJsonResponse(response.text || "{}");
    const parsed = JSON.parse(cleanedText);
    return {
      ...parsed,
      topicId
    } as Challenge;
  } catch (e) {
    throw new Error("Failed to parse AI response for challenge generation.");
  }
}

export async function gradeSubmission(challenge: Challenge, submission: string): Promise<GradingResult> {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: `
    Challenge Description: ${challenge.description}
    Context: ${challenge.context}
    User Submission: 
    \`\`\`go
    ${submission}
    \`\`\`

    Grade this submission. Is it correct? Does it achieve the goal described?
    Provide a gentle explanation if wrong and the correct solution.
    If the user's code is a valid alternative that works, mark it as correct.
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          correct: { type: Type.BOOLEAN },
          feedback: { type: Type.STRING, description: "Gentle feedback about the user's attempt." },
          solution: {
            type: Type.STRING,
            description:
              "Ideal Go reference solution only: idiomatic, multi-line, gofmt-style indentation (tabs or 4 spaces), with newlines between statements and blocks. No markdown fences—plain source only.",
          },
        },
        required: ["correct", "feedback", "solution"]
      },
      systemInstruction:
        "You are an expert Go concurrency tutor. You grade submissions accurately without executing code. Be encouraging but precise. Accept valid alternative solutions and idiomatic Go. When you include the solution string, output readable multi-line Go with standard formatting (like gofmt), never a single minified line and never wrapped in markdown code fences.",
    }
  });

  try {
    const cleanedText = cleanJsonResponse(response.text || "{}");
    return JSON.parse(cleanedText) as GradingResult;
  } catch (e) {
    throw new Error("Failed to parse AI response for grading.");
  }
}

export async function evaluateProgress(
  challenge: Challenge,
  submission: string,
  options?: { compactWhenCorrect?: boolean }
): Promise<ProgressEvaluationResult> {
  const compactWhenCorrect = options?.compactWhenCorrect ?? true;
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: `
Challenge Description: ${challenge.description}
Context: ${challenge.context}
Expected Outcome Criteria: ${challenge.expectedOutcomeCriteria}
Reference Solution (for evaluator context only):
\`\`\`go
${challenge.expectedReferenceSolution}
\`\`\`
User Submission:
\`\`\`go
${submission}
\`\`\`

Evaluate the user's progress toward a correct solution.
Use the expected criteria and reference solution only as evaluation anchors.
Mark correct=true if the user's code is functionally equivalent, even if implementation differs.
You MUST NOT provide a full solution, full code, or step-by-step instructions.
You MUST NOT provide any code blocks.
Only point out what is incorrect/missing and provide concept-level hints (which concurrency primitives or patterns to consider).
All issues and hints must stay within this challenge's scope and map to mismatches with the challenge requirements/expected criteria.
If the user's submission is fully correct, set correct=true. In that case:
- summary should say it's correct and suggest the user submit
- issues MUST be an empty array
- hints MUST be an empty array
`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          correct: { type: Type.BOOLEAN },
          summary: {
            type: Type.STRING,
            description:
              "1–3 sentences describing current progress and the most important gap (no code).",
          },
          issues: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              "Concrete problems with the current attempt (no code; no full solution).",
          },
          hints: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              "Concept-level hints: what to think about or which Go concurrency ideas to consider (no code).",
          },
          confidence: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH"] },
        },
        required: ["correct", "summary", "issues", "hints", "confidence"],
      },
      systemInstruction:
        "You are an expert Go concurrency tutor. You only evaluate progress and provide hints. Never reveal a complete solution, never write full code, and never give step-by-step solving instructions. Be brief, specific, and safe.",
    },
  });

  try {
    const cleanedText = cleanJsonResponse(response.text || "{}");
    const parsed = JSON.parse(cleanedText) as ProgressEvaluationResult;
    const sanitized = sanitizeProgressEvaluation(parsed);
    if (compactWhenCorrect && sanitized.correct) {
      return { ...sanitized, issues: [], hints: [] };
    }
    return sanitized;
  } catch (e) {
    throw new Error("Failed to parse AI response for progress evaluation.");
  }
}
