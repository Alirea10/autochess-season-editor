/** JSON encoding keeps the empty value distinct from the clearable "all" selection. */
export const typeFilterValue = (value: string | null | undefined) => JSON.stringify(value ?? '')
export function typeFilterOptions(known: string[], actual: (string | null | undefined)[], labels: Record<string, string>) {
  return [...new Set([...known, ...actual.map(value => value ?? '')])].map(value => ({
    value: typeFilterValue(value), label: value ? (labels[value] ? `${labels[value]} (${value})` : value) : '未设置',
  }))
}
export function matchesType(value: string | null | undefined, filter: string | null) {
  return filter === null || typeFilterValue(value) === filter
}
export function matchesSearch(values: (string | null | undefined)[], search: string) {
  const needle = search.trim().toLocaleLowerCase()
  return values.some(value => (value ?? '').toLocaleLowerCase().includes(needle))
}
