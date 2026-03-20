export interface SerialNumberOptions {
  page?: number;
  perPage?: number;
  startAt?: number;
}

export const serialNumber = (index: number, options: SerialNumberOptions = {}): number => {
  const { page, perPage, startAt } = options;

  if (typeof startAt === 'number' && Number.isFinite(startAt)) {
    return Math.max(1, Math.floor(startAt)) + index;
  }

  if (
    typeof page === 'number' && Number.isFinite(page) && page > 0
    && typeof perPage === 'number' && Number.isFinite(perPage) && perPage > 0
  ) {
    const offset = (Math.floor(page) - 1) * Math.floor(perPage);
    return offset + index + 1;
  }

  return index + 1;
};