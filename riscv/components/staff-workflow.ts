'use client';

export type StaffWorkflowVariant =
  | 'instructor-admin'
  | 'instructor-workbench'
  | 'ta';

export function isInstructorAdminWorkflow(variant: StaffWorkflowVariant) {
  return variant === 'instructor-admin';
}

export function isTAWorkflow(variant: StaffWorkflowVariant) {
  return variant === 'ta';
}

export function getStaffRoleLabel(variant: StaffWorkflowVariant) {
  return isTAWorkflow(variant) ? 'Teaching Assistant' : 'Instructor';
}

export function getStaffDashboardHref(variant: StaffWorkflowVariant) {
  if (variant === 'ta') return '/ta';
  return '/instructor';
}

export function getStaffCoursesHref(variant: StaffWorkflowVariant) {
  if (variant === 'ta') return '/ta/courses';
  return variant === 'instructor-workbench' ? '/instructor' : '/instructor/courses';
}

export function getStaffCourseBaseHref(variant: StaffWorkflowVariant) {
  if (variant === 'ta') return '/ta/courses';
  if (variant === 'instructor-workbench') return '/instructor/workbench/courses';
  return '/instructor/courses';
}

export function getStaffStudentLabsHref(variant: StaffWorkflowVariant) {
  if (variant === 'ta') return '/ta/student-labs-root';
  if (variant === 'instructor-workbench') return '/instructor/workbench/student-labs-root';
  return '/instructor/student-labs-root';
}
