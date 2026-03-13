export interface Profile {
  id: number;
  name: string;
  created_at: string;
}

export interface Exercise {
  id: number;
  name: string;
  muscles: string;
  type: string;
  equipment: string;
}

export interface Workout {
  id: number;
  profile_id: number;
  template_id: number | null;
  start_time: string;
  end_time: string | null;
  status: 'active' | 'completed' | 'cancelled';
  notes: string | null;
}

export interface WorkoutSet {
  id: number;
  workout_id: number;
  exercise_id: number;
  weight: number;
  reps: number;
  rir: number | null;
  set_number: number;
  notes: string | null;
  created_at: string;
  date?: string; // Sometimes joined in queries
}

export interface AnalyzedSession {
  date: string;
  sets: WorkoutSet[];
  maxE1rm: number;
  volumeLoad: number;
  maxReps: number;
  totalReps: number;
}

export interface Injury {
  id: number;
  profile_id: number;
  body_region: string;
  severity: 'mild' | 'moderate' | 'severe';
  description: string | null;
  affected_exercises: string | null;
  start_date: string;
  recovery_date: string | null;
  status: 'active' | 'recovered';
  notes: string | null;
}

export interface Template {
  id: number;
  profile_id: number;
  name: string;
}

export interface TemplateExercise {
  id: number;
  template_id: number;
  exercise_id: number;
  sets_config: string;
  sort_order: number;
}
