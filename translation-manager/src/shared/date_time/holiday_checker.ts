/**
 * Holiday and business day calculation utilities
 * Handles weekend detection, holiday checking, and business day calculations
 */

import { Holiday } from '@/types';

/**
 * Check if a date falls on a weekend
 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

/**
 * Check if a date is a business day (not weekend or holiday)
 */
export function isBusinessDay(date: Date, holidays: Holiday[]): boolean {
  if (isWeekend(date)) {
    return false;
  }

  const dateString = date.toISOString().split('T')[0];
  return !holidays.some(holiday => holiday.holiday_date === dateString);
}

/**
 * Calculate deadline by adding business days to start date, excluding weekends and holidays
 * @param startDate Starting date
 * @param businessDays Number of business days to add
 * @param holidays List of holidays to exclude
 * @returns Calculated deadline date
 */
export function calculateDeadline(
  startDate: Date,
  businessDays: number,
  holidays: Holiday[]
): Date {
  const result = new Date(startDate);
  let daysAdded = 0;

  while (daysAdded < businessDays) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result, holidays)) {
      daysAdded++;
    }
  }

  return result;
}

/**
 * Format deadline date for display
 * @param date Date to format
 * @returns Formatted date string (YYYY-MM-DD)
 */
export function formatDeadline(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format deadline date with day of week
 * @param date Date to format
 * @returns Formatted date string with day (e.g., "2024-12-25 (수)")
 */
export function formatDeadlineWithDay(date: Date): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dateStr = formatDeadline(date);
  const dayStr = days[date.getDay()];
  return `${dateStr} (${dayStr})`;
}

/**
 * Get holidays between two dates
 */
export function getHolidaysBetween(
  startDate: Date,
  endDate: Date,
  holidays: Holiday[]
): Holiday[] {
  const start = formatDeadline(startDate);
  const end = formatDeadline(endDate);

  return holidays.filter(holiday => {
    return holiday.holiday_date >= start && holiday.holiday_date <= end;
  });
}

/**
 * Count business days between two dates
 */
export function countBusinessDays(
  startDate: Date,
  endDate: Date,
  holidays: Holiday[]
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;

  const current = new Date(start);
  while (current <= end) {
    if (isBusinessDay(current, holidays)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}
