import { checkReachability, getReachableBaseUrl } from './reachability';

export type AssessmentDisplayMode = 'exam' | 'ca_test';

export interface AssessmentDisplayLabels {
  assessmentNoun: string;
  assessmentNounPlural: string;
  accessCodeLabel: string;
  accessCodeGeneratorTitle: string;
  studentPortalSubtitle: string;
}

export interface AssessmentDisplayConfig {
  mode: AssessmentDisplayMode;
  labels: AssessmentDisplayLabels;
}

const DEFAULT_LABELS: Record<AssessmentDisplayMode, AssessmentDisplayLabels> = {
  exam: {
    assessmentNoun: 'Exam',
    assessmentNounPlural: 'Exams',
    accessCodeLabel: 'Exam Access Code',
    accessCodeGeneratorTitle: 'Exam Access Code Generator',
    studentPortalSubtitle: 'Student Exam Portal',
  },
  ca_test: {
    assessmentNoun: 'CA Test',
    assessmentNounPlural: 'CA Tests',
    accessCodeLabel: 'CA Test Access Code',
    accessCodeGeneratorTitle: 'CA Test Access Code Generator',
    studentPortalSubtitle: 'Student CA Test Portal',
  },
};

export const normalizeAssessmentDisplayMode = (value: unknown): AssessmentDisplayMode =>
  String(value || '').trim().toLowerCase() === 'ca_test' ? 'ca_test' : 'exam';

export const assessmentLabelsForMode = (mode: AssessmentDisplayMode): AssessmentDisplayLabels => {
  return DEFAULT_LABELS[mode];
};

export const defaultAssessmentDisplayConfig: AssessmentDisplayConfig = {
  mode: 'exam',
  labels: DEFAULT_LABELS.exam,
};

const safeString = (value: unknown, fallback: string): string => {
  const normalized = String(value || '').trim();
  return normalized !== '' ? normalized : fallback;
};

export const fetchAssessmentDisplayConfig = async (): Promise<AssessmentDisplayConfig> => {
  try {
    const reachability = await checkReachability();
    const baseUrl = getReachableBaseUrl(reachability) || (process.env.REACT_APP_API_URL || 'http://localhost:8000/api');
    const response = await fetch(`${String(baseUrl).replace(/\/$/, '')}/cbt/config`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
    });

    if (!response.ok) {
      return defaultAssessmentDisplayConfig;
    }

    const payload = await response.json();
    const data = payload?.data || {};
    const labels = data?.labels || {};
    const mode = normalizeAssessmentDisplayMode(data?.mode);
    const defaults = assessmentLabelsForMode(mode);

    return {
      mode,
      labels: {
        assessmentNoun: safeString(labels?.assessment_noun, defaults.assessmentNoun),
        assessmentNounPlural: safeString(labels?.assessment_noun_plural, defaults.assessmentNounPlural),
        accessCodeLabel: safeString(labels?.access_code_label, defaults.accessCodeLabel),
        accessCodeGeneratorTitle: safeString(labels?.access_code_generator_title, defaults.accessCodeGeneratorTitle),
        studentPortalSubtitle: safeString(labels?.student_portal_subtitle, defaults.studentPortalSubtitle),
      },
    };
  } catch {
    return defaultAssessmentDisplayConfig;
  }
};
