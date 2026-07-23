const isLeapYear = (year: number): boolean =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const nextDate = (date: string): string => {
  const [yearText = "", monthText = "", dayText = ""] = date.split("-");
  let year = Number(yearText);
  let month = Number(monthText);
  let day = Number(dayText);
  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  day += 1;
  if (day > (daysInMonth[month - 1] ?? 0)) {
    day = 1;
    month += 1;
  }
  if (month > 12) {
    month = 1;
    year += 1;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

export const calendarDates = (startDate: string, endDate: string): readonly string[] => {
  const dates: string[] = [];
  for (let date = startDate; date < endDate; date = nextDate(date)) {
    dates.push(date);
  }
  return dates;
};
