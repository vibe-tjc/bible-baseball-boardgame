import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { QuestionData } from '../shared/protocol.js';

export class QuestionBank {
  private questions: QuestionData[] = [];
  private usedIds: Set<string> = new Set();

  /** Load questions from a JSON file */
  loadFromFile(filePath: string): void {
    if (!existsSync(filePath)) {
      console.warn(`[QuestionBank] File not found: ${filePath}`);
      return;
    }
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    if (Array.isArray(data.questions)) {
      this.questions.push(...data.questions);
      console.log(`[QuestionBank] Loaded ${data.questions.length} questions from ${filePath}`);
    }
  }

  /** Add a live question from the host */
  addLiveQuestion(question: QuestionData): void {
    this.questions.push(question);
  }

  /** Get the next unused question, or null if exhausted */
  getNext(): QuestionData | null {
    const available = this.questions.filter(q => !this.usedIds.has(q.id));
    if (available.length === 0) return null;

    // Pick a random unused question
    const index = Math.floor(Math.random() * available.length);
    const question = available[index];
    this.usedIds.add(question.id);
    return question;
  }

  /** Get a specific question (for pass-to-other, reuse same question) */
  getById(id: string): QuestionData | null {
    return this.questions.find(q => q.id === id) || null;
  }

  /** Reset used tracking */
  resetUsed(): void {
    this.usedIds.clear();
  }

  get totalCount(): number {
    return this.questions.length;
  }

  get remainingCount(): number {
    return this.questions.filter(q => !this.usedIds.has(q.id)).length;
  }
}
