export interface NavLinkConfig {
  name: string;
  path: string;
  icon: string;
  permissionName?: string;
  subItems?: NavLinkConfig[];
}

const toAccessNavLabel = (accessCodeLabel: string): string =>
  String(accessCodeLabel || "Exam Access Code")
    .replace(/\s+Code\s*$/i, "")
    .trim();

export const buildAdminNavLinks = (labels?: {
  assessmentNounPlural?: string;
  accessCodeLabel?: string;
}): NavLinkConfig[] => {
  const assessmentPlural =
    String(labels?.assessmentNounPlural || "Exams").trim() || "Exams";
  const accessLabel = toAccessNavLabel(
    String(labels?.accessCodeLabel || "Exam Access Code"),
  );

  return [
    { name: "Overview", path: "/admin", icon: "bx-home-alt" },
    {
      name: "Assessments",
      path: "/admin/exams",
      icon: "bx-book-content",
      subItems: [
        {
          name: "Questions",
          permissionName: "Questions",
          path: "/admin/questions",
          icon: "bx-edit-alt",
        },
        {
          name: assessmentPlural,
          permissionName: "Exams",
          path: "/admin/exams",
          icon: "bx-book-content",
        },
        {
          name: "Assessment Sittings",
          permissionName: "Exams",
          path: "/admin/exams/sittings",
          icon: "bx-calendar-event",
        },
        {
          name: accessLabel,
          permissionName: "Exam Access",
          path: "/admin/exam-access",
          icon: "bx-key",
        },
        {
          name: "Generate Access Codes",
          path: "/access-code-generator",
          icon: "bx-qr-scan",
        },
      ],
    },
    {
      name: "Academics",
      path: "/admin/subjects",
      icon: "bx-folder",
      subItems: [
        {
          name: "Academic Management",
          permissionName: "Academic Management",
          path: "/admin/subjects",
          icon: "bx-folder",
        },
        {
          name: "Students",
          permissionName: "Students",
          path: "/admin/students",
          icon: "bx-group",
        },
      ],
    },
    {
      name: "Operations",
      path: "/admin/announcements",
      icon: "bx-layer",
      subItems: [
        {
          name: "Announcements",
          permissionName: "Announcements",
          path: "/admin/announcements",
          icon: "bx-megaphone",
        },
        {
          name: "Offline Sync",
          permissionName: "Offline Sync",
          path: "/admin/sync",
          icon: "bx-sync",
        },
        {
          name: "View Allocations",
          permissionName: "View Allocations",
          path: "/admin/allocations",
          icon: "bx-list-ul",
        },
        {
          name: "Generate Allocation",
          permissionName: "Generate Allocation",
          path: "/admin/allocations/generate",
          icon: "bx-plus-circle",
        },
        {
          name: "Teacher Assignment",
          permissionName: "Teacher Assignment",
          path: "/admin/teachers/assign",
          icon: "bx-user-check",
        },
        {
          name: "Halls",
          permissionName: "Halls",
          path: "/admin/halls",
          icon: "bx-building",
        },
      ],
    },
    {
      name: "Results",
      path: "/admin/results",
      icon: "bx-bar-chart-alt-2",
      subItems: [
        {
          name: "Exam Results",
          permissionName: "Results & Marking",
          path: "/admin/results/exam",
          icon: "bx-clipboard",
        },
        {
          name: "Compiled Results",
          permissionName: "Results & Marking",
          path: "/admin/results/compiled",
          icon: "bx-line-chart",
        },
        {
          name: "Marking Workbench",
          permissionName: "Marking Workbench",
          path: "/admin/marking",
          icon: "bx-check-square",
        },
      ],
    },
  ];
};

export const adminNavLinks: NavLinkConfig[] = buildAdminNavLinks();
