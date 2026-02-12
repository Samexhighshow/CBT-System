export interface NavLinkConfig {
  name: string;
  path: string;
  icon: string;
  subItems?: NavLinkConfig[];
}

export const adminNavLinks: NavLinkConfig[] = [
  { name: 'Overview', path: '/admin', icon: 'bx-home-alt' },
  {
    name: 'Assessments',
    path: '/admin/exams',
    icon: 'bx-book-content',
    subItems: [
      { name: 'Questions', path: '/admin/questions', icon: 'bx-edit-alt' },
      { name: 'Exams', path: '/admin/exams', icon: 'bx-book-content' },
      { name: 'Exam Access', path: '/admin/exam-access', icon: 'bx-key' },
    ],
  },
  {
    name: 'Academics',
    path: '/admin/subjects',
    icon: 'bx-folder',
    subItems: [
      { name: 'Academic Management', path: '/admin/subjects', icon: 'bx-folder' },
      { name: 'Students', path: '/admin/students', icon: 'bx-group' },
    ],
  },
  {
    name: 'Operations',
    path: '/admin/announcements',
    icon: 'bx-layer',
    subItems: [
      { name: 'Announcements', path: '/admin/announcements', icon: 'bx-megaphone' },
      { name: 'View Allocations', path: '/admin/allocations', icon: 'bx-list-ul' },
      { name: 'Generate Allocation', path: '/admin/allocations/generate', icon: 'bx-plus-circle' },
      { name: 'Teacher Assignment', path: '/admin/teachers/assign', icon: 'bx-user-check' },
      { name: 'Halls', path: '/admin/halls', icon: 'bx-building' },
    ],
  },
  {
    name: 'Results',
    path: '/admin/results',
    icon: 'bx-bar-chart-alt-2',
    subItems: [
      { name: 'Results & Marking', path: '/admin/results', icon: 'bx-bar-chart-alt-2' },
      { name: 'Marking Workbench', path: '/admin/marking', icon: 'bx-check-square' },
    ],
  },
];
