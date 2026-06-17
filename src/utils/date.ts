import dayjs, { Dayjs } from "dayjs";

export function toDateString(value?: Dayjs | string | null) {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  return value.format("YYYY-MM-DD");
}

export function toDayjs(value?: string | null) {
  return value ? dayjs(value) : null;
}
