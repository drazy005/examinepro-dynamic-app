
export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  ADMIN = 'ADMIN',
  BASIC = 'BASIC'
}

export enum QuestionType {
  MCQ = 'MCQ',
  SBA = 'SBA',
  THEORY = 'THEORY'
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

export enum ResultRelease {
  INSTANT = 'INSTANT',
  DELAYED = 'DELAYED'
}

export enum DBEngine {
  MYSQL = 'MYSQL',
  POSTGRESQL = 'POSTGRESQL',
  ORACLE = 'ORACLE',
  FLAT_FILE = 'FLAT_FILE'
}

export enum ApiScope {
  READ_EXAMS = 'READ_EXAMS',
  WRITE_SUBMISSIONS = 'WRITE_SUBMISSIONS',
  READ_RESULTS = 'READ_RESULTS',
  ADMIN_FULL = 'ADMIN_FULL'
}

export interface ApiKey {
  id: string;
  key: string;
  label: string;
  scopes: ApiScope[];
  createdAt: number;
  lastUsedAt?: number;
  status: 'ACTIVE' | 'REVOKED';
}

export enum SimulatedProfile {
  STANDARD = 'STANDARD',
  HIGH_ACHIEVER = 'HIGH_ACHIEVER',
  ACCESSIBILITY = 'ACCESSIBILITY'
}

export interface SystemSettings {
  aiEnabled: boolean;
  maintenanceMode: boolean;
}

export interface AppBranding {
  primaryColor: string;
  appName: string;
  appIcon: string; 
  bannerImage: string; 
  backgroundImage: string;
  borderRadius: string; // "0px" | "8px" | "16px" | "32px" | "64px"
  fontFamily: 'sans' | 'mono' | 'serif';
}

export interface BlogPost {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: number;
  published: boolean;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  password?: string;
  lastActive?: number;
  isVerified: boolean;
  verificationToken?: string;
  passwordResetToken?: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  imageUrl?: string;
  options?: string[];
  correctAnswer: string;
  points: number;
  category?: string;
  createdAt?: number;
}

export interface TimerSettings {
  warningThresholdMinutes: number;
  autoSubmitOnExpiry: boolean;
  allowLateSubmission: boolean;
  latePenaltyPercentage: number;
  gracePeriodSeconds: number;
}

export interface GradingPolicy {
  negativeMarkingEnabled: boolean;
  negativeMarksPerQuestion: number;
  maxNegativeDeduction: number;
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: Difficulty;
  durationMinutes: number;
  questions: Question[];
  resultRelease: ResultRelease;
  createdAt: number;
  totalPoints: number;
  passMark: number;
  published: boolean;
  version: number;
  timerSettings: TimerSettings;
  gradingPolicy: GradingPolicy;
  scheduledReleaseAt?: number;
  fixedStartTime?: number;
  fixedEndTime?: number;
}

export interface ExamTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: Difficulty;
  durationMinutes: number;
  questions: Question[];
  timerSettings: TimerSettings;
  gradingPolicy: GradingPolicy;
  resultRelease: ResultRelease;
  createdAt: number;
}

export interface QuestionResult {
  score: number;
  feedback?: string;
  strengths?: string[];
  weaknesses?: string[];
  improvementSteps?: string[];
  isCorrect?: boolean;
}

export interface Submission {
  id: string;
  examId: string;
  examVersion: number;
  studentId: string;
  answers: Record<string, string>;
  questionResults: Record<string, QuestionResult>;
  score: number;
  rawScore: number;
  negativeDeduction: number;
  latePenaltyDeduction: number;
  graded: boolean;
  submittedAt: number;
  resultsReleased: boolean;
  timeStarted?: number;
  timeSpentMs?: number;
  isLate?: boolean;
  source?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  timestamp: number;
  details: string;
  ipAddress?: string;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
}

export interface DatabaseConfig {
  id: string;
  engine: DBEngine;
  host: string;
  port: number;
  databaseName: string;
  username: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  encrypted: boolean;
  lastTested?: number;
}